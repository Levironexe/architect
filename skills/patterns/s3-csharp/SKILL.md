---
schema_version: "2.0.0"
id: s3-csharp
name: "AWS S3 Storage (C#)"
version: "1.0.0"
description: "Object storage with pre-signed URLs for direct browser uploads, key-based DB references, DI-registered IAmazonS3, file type validation before signing, and secure download URLs."
category: pattern
language: csharp
frameworks: []
dependencies:
  none: []
detection:
  dependencies:
    any:
      - "AWSSDK.S3"
      - "Amazon.S3"
  source_indicators:
    - "using Amazon.S3"
    - "IAmazonS3"
    - "PutObjectRequest"
    - "GetPreSignedUrl"
structure:
  required_dirs: []
  recommended_dirs:
    - path: Services/
      purpose: "Upload and download service logic in StorageService.cs  -  CreateUploadUrlAsync() generates a pre-signed PUT URL, CreateDownloadUrlAsync() generates a pre-signed GET URL. Validates allowed MIME types before generating the URL to prevent arbitrary file uploads."
    - path: Models/
      purpose: "Domain models and DTOs. File-related entities store S3 object keys (not full URLs). UploadRequest and UploadResponse DTOs for the presign endpoint."
    - path: Infrastructure/
      purpose: "DI registration for IAmazonS3 in ServiceCollectionExtensions.cs. The only place that constructs AmazonS3Client. Credentials come from environment variables or IAM role  -  never hardcoded."
separation:
  rules:
    - concern: presigned_urls
      belongs_in: Services/
      rule_text: "Never proxy file bytes through your server. The upload flow is: (1) client calls your API to request a pre-signed PUT URL, (2) client uploads directly to S3 using that URL, (3) client notifies your API with the S3 key after upload completes. Server memory is never touched by file bytes."
      example: |
        // Services/StorageService.cs
        using Amazon.S3;
        using Amazon.S3.Model;

        public class StorageService : IStorageService
        {
            private readonly IAmazonS3 _s3;
            private readonly string _bucketName;

            private static readonly HashSet<string> AllowedMimeTypes = new()
            {
                "image/jpeg", "image/png", "image/webp", "image/gif"
            };

            public StorageService(IAmazonS3 s3, IConfiguration config)
            {
                _s3 = s3;
                _bucketName = config["AWS:BucketName"]
                    ?? throw new InvalidOperationException("AWS:BucketName not configured");
            }

            public async Task<UploadUrlResult> CreateUploadUrlAsync(
                string originalFilename, string contentType)
            {
                if (!AllowedMimeTypes.Contains(contentType))
                    throw new ArgumentException($"File type {contentType} is not allowed");

                var ext = Path.GetExtension(originalFilename);
                var key = $"uploads/{Guid.NewGuid()}{ext}";

                var request = new GetPreSignedUrlRequest
                {
                    BucketName = _bucketName,
                    Key = key,
                    Verb = HttpVerb.PUT,
                    ContentType = contentType,  // must match browser Content-Type header
                    Expires = DateTime.UtcNow.AddMinutes(5),
                };

                var url = await _s3.GetPreSignedURLAsync(request);
                return new UploadUrlResult(url, key);
            }

            public async Task<string> CreateDownloadUrlAsync(string key)
            {
                var request = new GetPreSignedUrlRequest
                {
                    BucketName = _bucketName,
                    Key = key,
                    Verb = HttpVerb.GET,
                    Expires = DateTime.UtcNow.AddHours(1),
                };
                return await _s3.GetPreSignedURLAsync(request);
            }
        }
      indicators:
        - "GetPreSignedUrl"
        - "PutObjectRequest"
        - "Expires"
    - concern: key_storage
      belongs_in: Models/
      rule_text: "Store the S3 object key (e.g. `uploads/abc123.jpg`) in your database  -  NOT the full S3 URL. Generate signed download URLs on-demand when serving the file to clients. This allows bucket migration, CDN changes, and URL policy changes without data migrations."
      example: |
        // Store key in DB  -  not the full URL
        user.AvatarKey = "uploads/abc123-def4.jpg";  // key only
        await _context.SaveChangesAsync();

        // Generate download URL on-demand in an API response
        var user = await _context.Users.FindAsync(userId);
        var avatarUrl = user.AvatarKey is not null
            ? await _storageService.CreateDownloadUrlAsync(user.AvatarKey)
            : null;
        return new UserResponse { User = user, AvatarUrl = avatarUrl };
      indicators:
        - "AvatarKey"
        - "FileKey"
        - "ImageKey"
        - "ObjectKey"
    - concern: client_di
      belongs_in: Infrastructure/
      rule_text: "Register IAmazonS3 as a singleton in the DI container in Infrastructure/ServiceCollectionExtensions.cs. Never call new AmazonS3Client() outside this registration. Credentials must come from environment variables or an IAM instance role  -  never hardcoded."
      example: |
        // Infrastructure/ServiceCollectionExtensions.cs
        using Amazon.S3;

        public static class ServiceCollectionExtensions
        {
            public static IServiceCollection AddS3Storage(
                this IServiceCollection services, IConfiguration config)
            {
                // Singleton: AWS SDK reuses HTTP connections for performance
                services.AddSingleton<IAmazonS3>(sp =>
                {
                    var s3Config = new AmazonS3Config
                    {
                        RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(
                            config["AWS:Region"] ?? "us-east-1")
                    };
                    // No explicit credentials: uses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
                    // from environment, or IAM role automatically
                    return new AmazonS3Client(s3Config);
                });

                services.AddScoped<IStorageService, StorageService>();
                return services;
            }
        }

        // Program.cs
        builder.Services.AddS3Storage(builder.Configuration);
      anti_indicators:
        - "new AmazonS3Client("
    - concern: upload_confirmation
      belongs_in: Controllers/
      rule_text: "After the client uploads directly to S3, it must call your API with the key to confirm the upload. Your API then validates that the key actually exists in S3 before storing it in the database. Without confirmation, an attacker can store arbitrary S3 keys pointing to non-existent or malicious objects."
      example: |
        // Controllers/UploadController.cs
        using Amazon.S3;
        using Amazon.S3.Model;

        [ApiController]
        [Route("api/upload")]
        public class UploadController : ControllerBase
        {
            private readonly IAmazonS3 _s3;
            private readonly IStorageService _storageService;
            private readonly string _bucketName;

            public UploadController(IAmazonS3 s3, IStorageService storageService,
                IConfiguration config)
            {
                _s3 = s3;
                _storageService = storageService;
                _bucketName = config["AWS:BucketName"]!;
            }

            [HttpPost("confirm")]
            public async Task<IActionResult> ConfirmUpload([FromBody] ConfirmRequest request)
            {
                // Validate that the object actually exists in S3
                try
                {
                    await _s3.GetObjectMetadataAsync(_bucketName, request.Key);
                }
                catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return NotFound("Object does not exist in S3");
                }

                // Only now save to DB
                var user = await _context.Users.FindAsync(request.UserId);
                user!.AvatarKey = request.Key;
                await _context.SaveChangesAsync();
                return Ok(new { Success = true });
            }
        }
      indicators:
        - "GetObjectMetadataAsync"
        - "Confirm"
    - concern: testability
      belongs_in: Tests/
      rule_text: "Mock IAmazonS3 in unit tests using Moq or NSubstitute. Test the upload/download/presign service methods without hitting real S3. For integration tests, use localstack or S3-compatible MinIO running in Docker. Never hardcode bucket names or credentials in tests  -  use test configuration."
      example: |
        // Tests/StorageServiceTests.cs
        using Amazon.S3;
        using Amazon.S3.Model;
        using Moq;
        using Xunit;

        public class StorageServiceTests
        {
            private readonly Mock<IAmazonS3> _mockS3;
            private readonly StorageService _service;

            public StorageServiceTests()
            {
                _mockS3 = new Mock<IAmazonS3>();
                _mockS3.Setup(x => x.GetPreSignedURLAsync(It.IsAny<GetPreSignedUrlRequest>()))
                    .ReturnsAsync("https://bucket.s3.amazonaws.com/signed-url");

                var config = new ConfigurationBuilder()
                    .AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["AWS:BucketName"] = "test-bucket",
                    })
                    .Build();

                _service = new StorageService(_mockS3.Object, config);
            }

            [Fact]
            public async Task CreateUploadUrl_ValidMimeType_ReturnsUrlAndKey()
            {
                var result = await _service.CreateUploadUrlAsync("photo.jpg", "image/jpeg");

                Assert.NotNull(result.Url);
                Assert.StartsWith("uploads/", result.Key);
                Assert.EndsWith(".jpg", result.Key);
            }

            [Fact]
            public async Task CreateUploadUrl_InvalidMimeType_ThrowsArgException()
            {
                await Assert.ThrowsAsync<ArgumentException>(
                    () => _service.CreateUploadUrlAsync("malware.exe", "application/x-msdownload"));
            }
        }
      indicators:
        - "Mock<IAmazonS3>"
        - "Moq"
        - "xUnit"
patterns:
  data_flow:
    direction: "Client -> POST /api/upload/presign (server validates MIME) -> S3 pre-signed PUT URL -> Client uploads directly to S3 -> Client POST /api/upload/confirm -> Server verifies object exists -> DB stores key"
    rules:
      - "File bytes never touch your server  -  client uploads directly to S3."
      - "Validate MIME type in CreateUploadUrlAsync() before generating the signed URL."
      - "Store S3 object keys in DB  -  generate signed download URLs on-demand."
      - "Confirm uploads server-side with GetObjectMetadataAsync before persisting the key."
      - "Set ContentType on GetPreSignedUrlRequest  -  browsers reject pre-signed uploads without it."
  error_handling:
    recommended: "Catch AmazonS3Exception with StatusCode 404 when generating download URLs  -  return null or NotFound if the object was deleted. Validate max file size on the client and enforce server-side in the presign endpoint."
  naming:
    client: "Infrastructure/ServiceCollectionExtensions.cs  -  DI-registered IAmazonS3 singleton; credentials from environment variables only"
    upload_service: "Services/StorageService.cs  -  CreateUploadUrlAsync() and CreateDownloadUrlAsync() live here"
    key_pattern: "[folder]/[guid].[ext]  -  e.g. uploads/a1b2c3d4-ef56-7890-abcd-ef1234567890.jpg"
anti_patterns:
  - id: proxy_upload
    severity: warning
    description: "Receiving uploaded files in your server and re-uploading to S3  -  doubles bandwidth cost, risks memory exhaustion on large files, and adds significant latency. A 50 MB file received by your server means 100 MB of total bandwidth usage."
    bad_example: |
      // BAD: File received by server, then uploaded to S3
      [HttpPost("upload")]
      public async Task<IActionResult> Upload(IFormFile file)
      {
          using var stream = file.OpenReadStream();
          var request = new PutObjectRequest
          {
              BucketName = _bucketName,
              Key = $"uploads/{file.FileName}",
              InputStream = stream,  // 50 MB in server RAM
          };
          await _s3.PutObjectAsync(request);
          return Ok(new { Key = request.Key });
      }
    good_example: |
      // GOOD: Server generates presigned URL  -  client uploads directly
      [HttpPost("presign")]
      public async Task<IActionResult> Presign([FromBody] PresignRequest req)
      {
          var result = await _storageService.CreateUploadUrlAsync(
              req.Filename, req.ContentType);
          return Ok(result);  // file never touches server
      }
  - id: store_full_url
    severity: warning
    description: "Storing full S3 URLs in the database  -  breaks when bucket, region, CDN domain, or URL signing policy changes. Migrating data is expensive; migrating a key column is trivial."
    bad_example: |
      // BAD: Full URL stored  -  breaks on bucket migration or CDN change
      user.AvatarUrl = "https://my-bucket.s3.us-east-1.amazonaws.com/uploads/photo.jpg";
      await _context.SaveChangesAsync();
    good_example: |
      // GOOD: Store key only  -  generate signed URL on every read
      user.AvatarKey = "uploads/abc123.jpg";
      await _context.SaveChangesAsync();
  - id: hardcoded_credentials
    severity: critical
    description: "Embedding AWS access keys directly in source code or committing them in appsettings.json. Secrets in git history are permanent  -  even if removed in a later commit, they remain in git log and forks."
    bad_example: |
      // BAD: Hardcoded credentials  -  leaked in git history forever
      var s3 = new AmazonS3Client(
          "AKIAIOSFODNN7EXAMPLE",
          "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          RegionEndpoint.USEast1
      );
    good_example: |
      // GOOD: AWS SDK reads credentials from environment automatically
      // Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment (never in source)
      // or use IAM role on EC2/ECS  -  no credentials needed in code
      var s3 = new AmazonS3Client(new AmazonS3Config
      {
          RegionEndpoint = RegionEndpoint.GetBySystemName(
              config["AWS:Region"] ?? "us-east-1")
      });
  - id: no_mime_validation
    severity: critical
    description: "Generating a pre-signed upload URL without validating the file's MIME type server-side. An attacker can request a signed URL for a .exe, .html (phishing), or .svg (XSS) file and upload it to your bucket  -  it will be served from your domain."
    bad_example: |
      // BAD: No MIME type validation  -  attacker uploads malware.exe
      public async Task<UploadUrlResult> CreateUploadUrlAsync(
          string filename, string contentType)
      {
          // contentType can be anything the client sends
          var request = new GetPreSignedUrlRequest
          {
              BucketName = _bucketName,
              Key = $"uploads/{filename}",
              Verb = HttpVerb.PUT,
              ContentType = contentType,
              Expires = DateTime.UtcNow.AddMinutes(5),
          };
          var url = await _s3.GetPreSignedURLAsync(request);
          return new UploadUrlResult(url, request.Key);
      }
    good_example: |
      // GOOD: Validate against allowlist before signing
      private static readonly HashSet<string> Allowed = new()
      {
          "image/jpeg", "image/png", "image/webp", "image/gif"
      };

      public async Task<UploadUrlResult> CreateUploadUrlAsync(
          string filename, string contentType)
      {
          if (!Allowed.Contains(contentType))
              throw new ArgumentException($"File type {contentType} not allowed");
          // ... proceed with presigning
      }
  - id: new_amazons3client_everywhere
    severity: warning
    description: "Creating new AmazonS3Client instances throughout the codebase instead of using DI. Each instance creates its own HTTP connection pool, wasting resources and bypassing centralized configuration."
    bad_example: |
      // BAD: New client in every method  -  connection pool waste
      public async Task UploadFile(string key, Stream data)
      {
          var client = new AmazonS3Client();  // new pool, new config
          await client.PutObjectAsync(new PutObjectRequest
          {
              BucketName = "my-bucket", Key = key, InputStream = data,
          });
      }

      public async Task<string> GetDownloadUrl(string key)
      {
          var client = new AmazonS3Client();  // yet another pool
          return await client.GetPreSignedURLAsync(new GetPreSignedUrlRequest
          {
              BucketName = "my-bucket", Key = key,
              Verb = HttpVerb.GET, Expires = DateTime.UtcNow.AddHours(1),
          });
      }
    good_example: |
      // GOOD: Inject IAmazonS3 via constructor  -  single shared pool
      public class StorageService : IStorageService
      {
          private readonly IAmazonS3 _s3;

          public StorageService(IAmazonS3 s3)
          {
              _s3 = s3;  // singleton registered in DI container
          }

          public async Task UploadFile(string key, Stream data)
          {
              await _s3.PutObjectAsync(new PutObjectRequest
              {
                  BucketName = _bucketName, Key = key, InputStream = data,
              });
          }
      }
---
