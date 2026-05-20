---
schema_version: "2.0.0"
id: s3-java
name: "AWS S3 Storage (Java)"
version: "1.0.0"
description: "Object storage with pre-signed URLs for direct browser uploads, key-based DB references, S3Client singleton, file type validation before signing, and secure download URLs."
category: pattern
language: java
frameworks: []
dependencies:
  none: []
detection:
  dependencies:
    any:
      - "software.amazon.awssdk:s3"
      - "com.amazonaws:aws-java-sdk-s3"
  source_indicators:
    - "import software.amazon.awssdk.services.s3"
    - "S3Client"
    - "PutObjectRequest"
    - "S3Presigner"
structure:
  required_dirs: []
  recommended_dirs:
    - path: src/main/java/services/
      purpose: "Upload and download service logic in StorageService.java  -  createUploadUrl() generates a pre-signed PUT URL, createDownloadUrl() generates a pre-signed GET URL. Validates allowed MIME types before generating the URL to prevent arbitrary file uploads."
    - path: src/main/java/config/
      purpose: "S3 client singleton in S3Config.java  -  the only class that builds S3Client and S3Presigner. Reads credentials from environment variables or IAM role when deployed on EC2/ECS. Registered as a Spring bean or static singleton."
    - path: src/test/java/
      purpose: "Unit tests using JUnit 5 with Mockito for S3 mocking. Integration tests can use localstack or S3-compatible MinIO in Docker via Testcontainers."
separation:
  rules:
    - concern: presigned_urls
      belongs_in: services/
      rule_text: "Never proxy file bytes through your server. The upload flow is: (1) client calls your API to request a pre-signed PUT URL, (2) client uploads directly to S3 using that URL, (3) client notifies your API with the S3 key after upload completes. Server memory is never touched by file bytes."
      example: |
        // services/StorageService.java
        import software.amazon.awssdk.services.s3.model.PutObjectRequest;
        import software.amazon.awssdk.services.s3.model.GetObjectRequest;
        import software.amazon.awssdk.services.s3.presigner.S3Presigner;
        import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
        import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
        import java.time.Duration;
        import java.util.Set;
        import java.util.UUID;

        public class StorageService {

            private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
                "image/jpeg", "image/png", "image/webp", "image/gif"
            );

            private final S3Presigner presigner;
            private final String bucketName;

            public StorageService(S3Presigner presigner, String bucketName) {
                this.presigner = presigner;
                this.bucketName = bucketName;
            }

            public UploadUrlResult createUploadUrl(String originalFilename, String contentType) {
                if (!ALLOWED_MIME_TYPES.contains(contentType)) {
                    throw new IllegalArgumentException(
                        "File type " + contentType + " is not allowed");
                }

                String ext = originalFilename.contains(".")
                    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                    : ".bin";
                String key = "uploads/" + UUID.randomUUID() + ext;

                PutObjectRequest objectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(contentType)  // must match browser Content-Type header
                    .build();

                PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(5))  // 5 min  -  enough for large files
                    .putObjectRequest(objectRequest)
                    .build();

                String url = presigner.presignPutObject(presignRequest)
                    .url().toString();

                return new UploadUrlResult(url, key);
            }

            public String createDownloadUrl(String key) {
                GetObjectRequest objectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();

                GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofHours(1))
                    .getObjectRequest(objectRequest)
                    .build();

                return presigner.presignGetObject(presignRequest)
                    .url().toString();
            }
        }
      indicators:
        - "S3Presigner"
        - "PutObjectPresignRequest"
        - "signatureDuration"
    - concern: key_storage
      belongs_in: models/
      rule_text: "Store the S3 object key (e.g. `uploads/abc123.jpg`) in your database  -  NOT the full S3 URL. Generate signed download URLs on-demand when serving the file to clients. This allows bucket migration, CDN changes, and URL policy changes without data migrations."
      example: |
        // Store key in DB  -  not the full URL
        user.setAvatarKey("uploads/abc123-def4.jpg");  // key only
        userRepository.save(user);

        // Generate download URL on-demand in an API response
        User user = userRepository.findById(userId).orElseThrow();
        String avatarUrl = user.getAvatarKey() != null
            ? storageService.createDownloadUrl(user.getAvatarKey())
            : null;
        return new UserResponse(user, avatarUrl);  // URL expires  -  never cached in DB
      indicators:
        - "avatarKey"
        - "fileKey"
        - "imageKey"
        - "objectKey"
    - concern: client_singleton
      belongs_in: config/
      rule_text: "Create the S3Client and S3Presigner as singletons in config/S3Config.java. Never call S3Client.builder().build() outside this class. Credentials must come from environment variables or an IAM instance role  -  never hardcoded. In Spring, use @Configuration with @Bean methods."
      example: |
        // config/S3Config.java
        import software.amazon.awssdk.regions.Region;
        import software.amazon.awssdk.services.s3.S3Client;
        import software.amazon.awssdk.services.s3.presigner.S3Presigner;
        import org.springframework.context.annotation.Bean;
        import org.springframework.context.annotation.Configuration;

        @Configuration
        public class S3Config {

            @Bean
            public S3Client s3Client() {
                // Singleton: AWS SDK reuses HTTP connections for performance
                // No explicit credentials: uses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
                // from environment, or IAM role automatically
                return S3Client.builder()
                    .region(Region.of(
                        System.getenv().getOrDefault("AWS_REGION", "us-east-1")))
                    .build();
            }

            @Bean
            public S3Presigner s3Presigner() {
                return S3Presigner.builder()
                    .region(Region.of(
                        System.getenv().getOrDefault("AWS_REGION", "us-east-1")))
                    .build();
            }
        }
      anti_indicators:
        - "S3Client.builder().build()"
    - concern: upload_confirmation
      belongs_in: controllers/
      rule_text: "After the client uploads directly to S3, it must call your API with the key to confirm the upload. Your API then validates that the key actually exists in S3 before storing it in the database. Without confirmation, an attacker can store arbitrary S3 keys pointing to non-existent or malicious objects."
      example: |
        // controllers/UploadController.java
        import software.amazon.awssdk.services.s3.S3Client;
        import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
        import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
        import org.springframework.web.bind.annotation.*;

        @RestController
        @RequestMapping("/api/upload")
        public class UploadController {

            private final S3Client s3Client;
            private final StorageService storageService;
            private final String bucketName;

            public UploadController(S3Client s3Client, StorageService storageService,
                    @Value("${aws.s3.bucket}") String bucketName) {
                this.s3Client = s3Client;
                this.storageService = storageService;
                this.bucketName = bucketName;
            }

            @PostMapping("/confirm")
            public ResponseEntity<?> confirmUpload(@RequestBody ConfirmRequest request) {
                // Validate that the object actually exists in S3
                try {
                    s3Client.headObject(HeadObjectRequest.builder()
                        .bucket(bucketName)
                        .key(request.getKey())
                        .build());
                } catch (NoSuchKeyException e) {
                    return ResponseEntity.notFound().build();
                }

                // Only now save to DB
                User user = userRepository.findById(request.getUserId()).orElseThrow();
                user.setAvatarKey(request.getKey());
                userRepository.save(user);
                return ResponseEntity.ok(Map.of("success", true));
            }
        }
      indicators:
        - "HeadObjectRequest"
        - "confirm"
    - concern: testability
      belongs_in: src/test/java/
      rule_text: "Mock S3Client and S3Presigner in unit tests using Mockito. Test the upload/download/presign service methods without hitting real S3. For integration tests, use localstack via Testcontainers or S3-compatible MinIO in Docker. Never hardcode bucket names or credentials in tests  -  use test configuration."
      example: |
        // src/test/java/services/StorageServiceTest.java
        import org.junit.jupiter.api.BeforeEach;
        import org.junit.jupiter.api.Test;
        import org.mockito.Mock;
        import org.mockito.MockitoAnnotations;
        import software.amazon.awssdk.services.s3.presigner.S3Presigner;
        import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
        import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
        import java.net.URL;

        import static org.junit.jupiter.api.Assertions.*;
        import static org.mockito.ArgumentMatchers.any;
        import static org.mockito.Mockito.when;

        class StorageServiceTest {

            @Mock
            private S3Presigner presigner;

            @Mock
            private PresignedPutObjectRequest presignedRequest;

            private StorageService service;

            @BeforeEach
            void setUp() throws Exception {
                MockitoAnnotations.openMocks(this);
                when(presignedRequest.url()).thenReturn(new URL("https://bucket.s3.amazonaws.com/signed"));
                when(presigner.presignPutObject(any(PutObjectPresignRequest.class)))
                    .thenReturn(presignedRequest);

                service = new StorageService(presigner, "test-bucket");
            }

            @Test
            void createUploadUrl_validMimeType_returnsUrlAndKey() {
                UploadUrlResult result = service.createUploadUrl("photo.jpg", "image/jpeg");

                assertNotNull(result.getUrl());
                assertTrue(result.getKey().startsWith("uploads/"));
                assertTrue(result.getKey().endsWith(".jpg"));
            }

            @Test
            void createUploadUrl_invalidMimeType_throwsException() {
                assertThrows(IllegalArgumentException.class,
                    () -> service.createUploadUrl("malware.exe", "application/x-msdownload"));
            }
        }
      indicators:
        - "@Mock"
        - "Mockito"
        - "JUnit"
patterns:
  data_flow:
    direction: "Client -> POST /api/upload/presign (server validates MIME) -> S3 pre-signed PUT URL -> Client uploads directly to S3 -> Client POST /api/upload/confirm -> Server verifies object exists -> DB stores key"
    rules:
      - "File bytes never touch your server  -  client uploads directly to S3."
      - "Validate MIME type in createUploadUrl() before generating the signed URL."
      - "Store S3 object keys in DB  -  generate signed download URLs on-demand."
      - "Confirm uploads server-side with headObject before persisting the key."
      - "Set contentType on PutObjectRequest  -  browsers reject pre-signed uploads without it."
  error_handling:
    recommended: "Catch NoSuchKeyException when generating download URLs  -  return null or 404 if the object was deleted. Validate max file size on the client and enforce server-side in the presign endpoint."
  naming:
    client: "config/S3Config.java  -  singleton S3Client and S3Presigner beans; credentials from environment variables only"
    upload_service: "services/StorageService.java  -  createUploadUrl() and createDownloadUrl() live here"
    key_pattern: "[folder]/[uuid].[ext]  -  e.g. uploads/a1b2c3d4-ef56-7890-abcd-ef1234567890.jpg"
anti_patterns:
  - id: proxy_upload
    severity: warning
    description: "Receiving uploaded files in your server and re-uploading to S3  -  doubles bandwidth cost, risks memory exhaustion on large files, and adds significant latency. A 50 MB file received by your server means 100 MB of total bandwidth usage."
    bad_example: |
      // BAD: File received by server, then uploaded to S3
      @PostMapping("/upload")
      public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) throws Exception {
          s3Client.putObject(
              PutObjectRequest.builder()
                  .bucket(bucketName)
                  .key("uploads/" + file.getOriginalFilename())
                  .build(),
              RequestBody.fromInputStream(file.getInputStream(), file.getSize())  // 50 MB in server RAM
          );
          return ResponseEntity.ok(Map.of("key", "uploads/" + file.getOriginalFilename()));
      }
    good_example: |
      // GOOD: Server generates presigned URL  -  client uploads directly
      @PostMapping("/presign")
      public ResponseEntity<?> presign(@RequestBody PresignRequest request) {
          UploadUrlResult result = storageService.createUploadUrl(
              request.getFilename(), request.getContentType());
          return ResponseEntity.ok(result);  // file never touches server
      }
  - id: store_full_url
    severity: warning
    description: "Storing full S3 URLs in the database  -  breaks when bucket, region, CDN domain, or URL signing policy changes. Migrating data is expensive; migrating a key column is trivial."
    bad_example: |
      // BAD: Full URL stored  -  breaks on bucket migration or CDN change
      user.setAvatarUrl("https://my-bucket.s3.us-east-1.amazonaws.com/uploads/photo.jpg");
      userRepository.save(user);
    good_example: |
      // GOOD: Store key only  -  generate signed URL on every read
      user.setAvatarKey("uploads/abc123.jpg");
      userRepository.save(user);
  - id: hardcoded_credentials
    severity: critical
    description: "Embedding AWS access keys directly in source code or committing them in application.properties. Secrets in git history are permanent  -  even if removed in a later commit, they remain in git log and forks."
    bad_example: |
      // BAD: Hardcoded credentials  -  leaked in git history forever
      S3Client s3 = S3Client.builder()
          .region(Region.US_EAST_1)
          .credentialsProvider(StaticCredentialsProvider.create(
              AwsBasicCredentials.create(
                  "AKIAIOSFODNN7EXAMPLE",
                  "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")))
          .build();
    good_example: |
      // GOOD: AWS SDK reads credentials from environment automatically
      // Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment (never in source)
      // or use IAM role on EC2/ECS  -  no credentials needed in code
      S3Client s3 = S3Client.builder()
          .region(Region.of(System.getenv().getOrDefault("AWS_REGION", "us-east-1")))
          .build();
  - id: no_mime_validation
    severity: critical
    description: "Generating a pre-signed upload URL without validating the file's MIME type server-side. An attacker can request a signed URL for a .exe, .html (phishing), or .svg (XSS) file and upload it to your bucket  -  it will be served from your domain."
    bad_example: |
      // BAD: No MIME type validation  -  attacker uploads malware.exe
      public UploadUrlResult createUploadUrl(String filename, String contentType) {
          // contentType can be anything the client sends
          PutObjectRequest request = PutObjectRequest.builder()
              .bucket(bucketName)
              .key("uploads/" + filename)
              .contentType(contentType)
              .build();
          // ... presign and return
      }
    good_example: |
      // GOOD: Validate against allowlist before signing
      private static final Set<String> ALLOWED = Set.of(
          "image/jpeg", "image/png", "image/webp", "image/gif");

      public UploadUrlResult createUploadUrl(String filename, String contentType) {
          if (!ALLOWED.contains(contentType)) {
              throw new IllegalArgumentException("File type " + contentType + " not allowed");
          }
          // ... proceed with presigning
      }
---
