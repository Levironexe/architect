---
schema_version: "2.0.0"
id: s3-python
name: "AWS S3 Storage (Python)"
version: "1.0.0"
description: "Object storage with pre-signed URLs for direct browser uploads, key-based DB references, boto3 client singleton, file type validation before signing, and secure download URLs."
category: pattern
language: python
frameworks: []
dependencies:
  none: []
detection:
  dependencies:
    any:
      - "boto3"
      - "botocore"
  source_indicators:
    - "import boto3"
    - "s3_client"
    - "generate_presigned_url"
    - "put_object"
structure:
  required_dirs: []
  recommended_dirs:
    - path: services/
      purpose: "Upload and download service logic in storage_service.py  -  create_upload_url() generates a pre-signed PUT URL, create_download_url() generates a pre-signed GET URL. Validates allowed MIME types before generating the URL to prevent arbitrary file uploads."
    - path: lib/
      purpose: "S3 client singleton in s3.py  -  the only module that calls boto3.client('s3'). Reads credentials from environment variables or IAM role when deployed on EC2/ECS/Lambda. Imported by the upload service only  -  never by route handlers or views directly."
    - path: tests/
      purpose: "Unit tests using pytest with moto for S3 mocking. Integration tests can use localstack or MinIO in Docker."
separation:
  rules:
    - concern: presigned_urls
      belongs_in: services/
      rule_text: "Never proxy file bytes through your server. The upload flow is: (1) client calls your API to request a pre-signed PUT URL, (2) client uploads directly to S3 using that URL, (3) client notifies your API with the S3 key after upload completes. Server memory is never touched by file bytes."
      example: |
        # services/storage_service.py
        import uuid
        from lib.s3 import get_s3_client

        ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

        def create_upload_url(original_filename: str, content_type: str) -> dict:
            """Generate a pre-signed PUT URL for direct browser upload to S3."""
            if content_type not in ALLOWED_MIME_TYPES:
                raise ValueError(f"File type {content_type} is not allowed")

            ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
            key = f"uploads/{uuid.uuid4()}.{ext}"

            s3 = get_s3_client()
            url = s3.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": os.environ["S3_BUCKET"],
                    "Key": key,
                    "ContentType": content_type,  # must match browser Content-Type header
                },
                ExpiresIn=300,  # 5 minutes  -  enough for large files
            )
            return {"url": url, "key": key}

        def create_download_url(key: str) -> str:
            """Generate a pre-signed GET URL to serve a stored file."""
            s3 = get_s3_client()
            return s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": os.environ["S3_BUCKET"], "Key": key},
                ExpiresIn=3600,  # 1 hour
            )
      indicators:
        - "generate_presigned_url"
        - "put_object"
        - "ExpiresIn"
    - concern: key_storage
      belongs_in: models/
      rule_text: "Store the S3 object key (e.g. `uploads/abc123.jpg`) in your database  -  NOT the full S3 URL. Generate signed download URLs on-demand when serving the file to clients. This allows bucket migration, CDN changes, and URL policy changes without data migrations."
      example: |
        # Store key in DB  -  not the full URL
        user.avatar_key = "uploads/abc123-def4.jpg"  # key only
        db.session.commit()

        # Generate download URL on-demand in an API response
        user = db.session.get(User, user_id)
        avatar_url = (
            create_download_url(user.avatar_key)
            if user.avatar_key
            else None
        )
        return {"user": user.to_dict(), "avatar_url": avatar_url}
      indicators:
        - "avatar_key"
        - "file_key"
        - "image_key"
        - "object_key"
    - concern: client_singleton
      belongs_in: lib/s3.py
      rule_text: "Create the S3 client as a module-level singleton in lib/s3.py. Never call boto3.client('s3') outside this file. Credentials must come from environment variables or an IAM instance role  -  never hardcoded."
      example: |
        # lib/s3.py
        import os
        import boto3

        _s3_client = None

        def get_s3_client():
            """Return a singleton boto3 S3 client. Reuses HTTP connections."""
            global _s3_client
            if _s3_client is None:
                _s3_client = boto3.client(
                    "s3",
                    region_name=os.environ.get("AWS_REGION", "us-east-1"),
                    # No explicit credentials: uses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
                    # from environment, or IAM role automatically
                )
            return _s3_client
      anti_indicators:
        - "boto3.client('s3',"
    - concern: upload_confirmation
      belongs_in: api/
      rule_text: "After the client uploads directly to S3, it must call your API with the key to confirm the upload. Your API then validates that the key actually exists in S3 before storing it in the database. Without confirmation, an attacker can store arbitrary S3 keys pointing to non-existent or malicious objects."
      example: |
        # api/upload_confirm.py
        import os
        from botocore.exceptions import ClientError
        from lib.s3 import get_s3_client

        def confirm_upload(key: str, user_id: int) -> dict:
            """Verify the object exists in S3 before saving key to DB."""
            s3 = get_s3_client()
            try:
                s3.head_object(Bucket=os.environ["S3_BUCKET"], Key=key)
            except ClientError as e:
                if e.response["Error"]["Code"] == "404":
                    raise ValueError("Object does not exist in S3")
                raise

            # Only now save to DB
            user = db.session.get(User, user_id)
            user.avatar_key = key
            db.session.commit()
            return {"success": True}
      indicators:
        - "head_object"
        - "confirm"
    - concern: testability
      belongs_in: tests/
      rule_text: "Mock S3 in unit tests using moto or unittest.mock.patch. Test the upload/download/presign service functions without hitting real S3. For integration tests, use localstack or S3-compatible MinIO running in Docker. Never hardcode bucket names or credentials in tests  -  use a test config or fixtures."
      example: |
        # tests/test_storage_service.py
        import os
        import pytest
        from moto import mock_aws

        @mock_aws
        def test_create_upload_url():
            """Pre-signed URL generation with moto S3 mock."""
            import boto3
            # moto intercepts boto3 calls  -  no real AWS traffic
            conn = boto3.client("s3", region_name="us-east-1")
            conn.create_bucket(Bucket="test-bucket")
            os.environ["S3_BUCKET"] = "test-bucket"
            os.environ["AWS_REGION"] = "us-east-1"

            from services.storage_service import create_upload_url

            result = create_upload_url("photo.jpg", "image/jpeg")
            assert "url" in result
            assert result["key"].startswith("uploads/")
            assert result["key"].endswith(".jpg")

        @mock_aws
        def test_create_upload_url_rejects_invalid_mime():
            """Disallowed MIME types must raise ValueError."""
            from services.storage_service import create_upload_url

            with pytest.raises(ValueError, match="not allowed"):
                create_upload_url("malware.exe", "application/x-msdownload")
      indicators:
        - "mock_aws"
        - "moto"
        - "pytest"
patterns:
  data_flow:
    direction: "Client -> POST /upload/presign (server validates MIME) -> S3 pre-signed PUT URL -> Client uploads directly to S3 -> Client POST /upload/confirm -> Server verifies object exists -> DB stores key"
    rules:
      - "File bytes never touch your server  -  client uploads directly to S3."
      - "Validate MIME type in create_upload_url() before generating the signed URL."
      - "Store S3 object keys in DB  -  generate signed download URLs on-demand."
      - "Confirm uploads server-side with head_object before persisting the key."
      - "Set ContentType in presign Params  -  browsers reject pre-signed uploads without it."
  error_handling:
    recommended: "Catch botocore.exceptions.ClientError with error code NoSuchKey when generating download URLs  -  return None or 404 if the object was deleted. Validate max file size on the client and enforce server-side in the presign endpoint."
  naming:
    client: "lib/s3.py  -  singleton boto3 S3 client; credentials from environment variables only"
    upload_service: "services/storage_service.py  -  create_upload_url() and create_download_url() live here"
    key_pattern: "[folder]/[uuid].[ext]  -  e.g. uploads/a1b2c3d4-ef56-7890-abcd-ef1234567890.jpg"
anti_patterns:
  - id: proxy_upload
    severity: warning
    description: "Receiving uploaded files in your server and re-uploading to S3  -  doubles bandwidth cost, risks memory exhaustion on large files, and adds significant latency. A 50 MB file received by your server means 100 MB of total bandwidth usage."
    bad_example: |
      # BAD: File received by server, then uploaded to S3
      @app.route("/upload", methods=["POST"])
      def upload():
          file = request.files["file"]
          s3 = get_s3_client()
          s3.upload_fileobj(
              file.stream,  # 50 MB in server RAM
              os.environ["S3_BUCKET"],
              f"uploads/{file.filename}",
          )
          return jsonify({"key": f"uploads/{file.filename}"})
    good_example: |
      # GOOD: Server generates presigned URL  -  client uploads directly
      @app.route("/upload/presign", methods=["POST"])
      def presign():
          data = request.get_json()
          result = create_upload_url(data["filename"], data["content_type"])
          return jsonify(result)  # file never touches server
  - id: store_full_url
    severity: warning
    description: "Storing full S3 URLs in the database  -  breaks when bucket, region, CDN domain, or URL signing policy changes. Migrating data is expensive; migrating a key column is trivial."
    bad_example: |
      # BAD: Full URL stored  -  breaks on bucket migration or CDN change
      user.avatar_url = "https://my-bucket.s3.us-east-1.amazonaws.com/uploads/photo.jpg"
      db.session.commit()
    good_example: |
      # GOOD: Store key only  -  generate signed URL on every read
      user.avatar_key = "uploads/abc123.jpg"
      db.session.commit()
  - id: hardcoded_credentials
    severity: critical
    description: "Embedding AWS access keys directly in source code or committing them in .env files. Secrets in git history are permanent  -  even if removed in a later commit, they remain in git log and forks."
    bad_example: |
      # BAD: Hardcoded credentials  -  leaked in git history forever
      s3 = boto3.client(
          "s3",
          aws_access_key_id="AKIAIOSFODNN7EXAMPLE",
          aws_secret_access_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          region_name="us-east-1",
      )
    good_example: |
      # GOOD: boto3 reads credentials from environment automatically
      # Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env (never committed)
      # or use IAM role on EC2/ECS/Lambda  -  no credentials needed in code
      s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "us-east-1"))
  - id: no_mime_validation
    severity: critical
    description: "Generating a pre-signed upload URL without validating the file's MIME type server-side. An attacker can request a signed URL for a .exe, .html (phishing), or .svg (XSS) file and upload it to your bucket  -  it will be served from your domain."
    bad_example: |
      # BAD: No MIME type validation  -  attacker uploads malware.exe
      def presign_upload(filename: str, content_type: str):
          s3 = get_s3_client()
          # content_type can be anything the client sends
          url = s3.generate_presigned_url(
              "put_object",
              Params={
                  "Bucket": os.environ["S3_BUCKET"],
                  "Key": f"uploads/{filename}",
                  "ContentType": content_type,
              },
              ExpiresIn=300,
          )
          return {"url": url}
    good_example: |
      # GOOD: Validate against allowlist before signing
      ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/gif"}

      def presign_upload(filename: str, content_type: str):
          if content_type not in ALLOWED:
              raise ValueError(f"File type {content_type} not allowed")
          return create_upload_url(filename, content_type)
  - id: no_upload_confirmation
    severity: warning
    description: "Saving the S3 key to the database immediately after generating the pre-signed URL, without waiting for the client to confirm the upload completed. The object may never be uploaded, leaving dangling DB references."
    bad_example: |
      # BAD: Save key before upload actually happens
      @app.route("/upload/presign", methods=["POST"])
      def presign():
          data = request.get_json()
          result = create_upload_url(data["filename"], data["content_type"])
          # Saving key now  -  but the upload hasn't happened yet!
          user.avatar_key = result["key"]
          db.session.commit()
          return jsonify(result)
    good_example: |
      # GOOD: Separate presign and confirm endpoints
      @app.route("/upload/presign", methods=["POST"])
      def presign():
          data = request.get_json()
          result = create_upload_url(data["filename"], data["content_type"])
          return jsonify(result)  # key not saved yet

      @app.route("/upload/confirm", methods=["POST"])
      def confirm():
          data = request.get_json()
          return jsonify(confirm_upload(data["key"], current_user.id))
---
