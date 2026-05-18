---
schema_version: "2.0.0"
id: django
name: "Django + DRF"
version: "1.0.0"
description: "Django 5.x project structure with the services/selectors pattern, thin DRF API views, and correct model, serializer, and URL separation."
category: stack
language: python
frameworks:
  - django
  - djangorestframework
detection:
  dependencies:
    any:
      - django
      - djangorestframework
  files:
    - manage.py
    - settings.py
    - wsgi.py
    - asgi.py
  source_indicators:
    - "from django"
    - "from rest_framework"
    - "Django"
    - "INSTALLED_APPS"
structure:
  required_dirs:
    - path: "config/"
      purpose: "Project-level configuration. Contains settings split by environment (base.py, local.py, production.py, test.py), the top-level urls.py, wsgi.py, asgi.py, and celery.py if used. No app code lives here."
    - path: "{app_name}/models.py"
      purpose: "Database schema definition for this Django app. Models define fields, relationships, and __str__. Custom clean() for field-level validation is acceptable. No cross-model orchestration or external API calls."
    - path: "{app_name}/services.py"
      purpose: "Write operations and mutations for this domain. Functions here create, update, or delete records and orchestrate multi-model changes. Always called by API views — never accessed from templates or signals."
    - path: "{app_name}/selectors.py"
      purpose: "Read-only query functions for this domain. Returns QuerySets or plain values. Views call selectors to fetch data — never write raw ORM queries inside views or serializers."
    - path: "{app_name}/apis.py"
      purpose: "DRF API views (APIView subclasses or @api_view functions). Thin: parse input with InputSerializer, call service or selector, return OutputSerializer. No business logic here."
    - path: "{app_name}/urls.py"
      purpose: "URL patterns for this app. Included from config/urls.py. Route names follow the app_name:action convention."
  recommended_dirs:
    - path: "{app_name}/serializers.py"
      purpose: "Standalone serializers used across multiple views. Keep InputSerializer and OutputSerializer as nested classes inside the API view they belong to when only one view uses them — move to serializers.py when shared."
    - path: "{app_name}/tests/"
      purpose: "Tests organised by layer: tests/services/, tests/selectors/, tests/apis/. Use factories (factory_boy) to create test data. Test services and selectors directly without HTTP."
    - path: "{app_name}/admin.py"
      purpose: "Django admin registration for this app's models. Admin actions that modify data should call service functions, not manipulate ORM directly."
separation:
  rules:
    - concern: write_operations
      belongs_in: "{app_name}/services.py"
      rule_text: "All create, update, and delete operations live in service functions. Services receive plain Python arguments (not request objects or serializer instances), call model methods and ORM, and raise domain exceptions. Views call services and translate exceptions to HTTP responses."
      example: |
        # users/services.py — correct: service owns the write operation
        from .models import User
        from django.core.exceptions import ValidationError

        def create_user(*, email: str, password: str, full_name: str) -> User:
            if User.objects.filter(email=email).exists():
                raise ValidationError("A user with this email already exists.")
            user = User(email=email, full_name=full_name)
            user.set_password(password)
            user.full_clean()
            user.save()
            return user
      anti_indicators:
        - "self.request"
        - "serializer.save"
    - concern: read_operations
      belongs_in: "{app_name}/selectors.py"
      rule_text: "All QuerySet construction and filtering lives in selector functions. Selectors are read-only — they never call save(), delete(), or create(). Views use selectors to fetch data and pass it to output serializers."
      example: |
        # users/selectors.py — correct: selector owns the query
        from .models import User
        from django.db.models import QuerySet

        def get_user_by_id(*, user_id: int) -> User:
            return User.objects.select_related("profile").get(id=user_id)

        def list_active_users() -> QuerySet[User]:
            return User.objects.filter(is_active=True).order_by("-created_at")
      anti_indicators:
        - ".save()"
        - ".delete()"
        - ".create("
    - concern: api_views
      belongs_in: "{app_name}/apis.py"
      rule_text: "DRF API views are thin. They validate input with a nested InputSerializer, call one service or selector function, and return an OutputSerializer. No ORM queries, no if/else domain logic. Separate InputSerializer and OutputSerializer classes are nested inside the view class."
      example: |
        # users/apis.py — correct: thin view with nested serializers
        from rest_framework.views import APIView
        from rest_framework.response import Response
        from rest_framework import status, serializers
        from .services import create_user
        from .selectors import get_user_by_id

        class UserCreateApi(APIView):
            class InputSerializer(serializers.Serializer):
                email = serializers.EmailField()
                password = serializers.CharField(write_only=True)
                full_name = serializers.CharField()

            class OutputSerializer(serializers.Serializer):
                id = serializers.IntegerField()
                email = serializers.EmailField()

            def post(self, request):
                serializer = self.InputSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                user = create_user(**serializer.validated_data)
                return Response(self.OutputSerializer(user).data, status=status.HTTP_201_CREATED)
patterns:
  data_flow:
    direction: "HTTP Request → API View (InputSerializer validation) → Service (mutations) or Selector (queries) → Model (ORM) → OutputSerializer → Response"
    rules:
      - "Services and selectors take keyword-only arguments (use * in function signature). This enforces named calling and prevents positional argument errors."
      - "Avoid DRF ModelSerializer when the API shape doesn't match the model 1:1 — use plain Serializer and be explicit."
      - "Never use Django signals to trigger business logic. Signals make data flow implicit and untraceable. Use service calls instead."
      - "Settings split: base.py has shared config, local.py and production.py override. Use django-environ or python-decouple to read from environment — never hardcode secrets."
      - "Use select_related() and prefetch_related() in selectors, not in views or templates, to prevent N+1 queries."
  naming:
    apps: "Use singular lowercase names for Django apps (user, post, order). Avoid generic names like api or core unless they truly contain cross-cutting concerns."
    urls: "Name URL patterns with app_name:action convention (users:create, users:detail). Use include() with app_name set."
anti_patterns:
  - id: logic_in_save
    severity: critical
    description: "Business logic or cross-model orchestration is placed in Model.save() or Model.delete() overrides. These methods are bypassed by QuerySet.update(), bulk_create(), and bulk_update(), so the logic silently does not run in bulk operations. This creates data integrity bugs that are hard to detect."
    bad_example: |
      # wrong: orchestration in save()
      class Order(models.Model):
          def save(self, *args, **kwargs):
              super().save(*args, **kwargs)
              # This is bypassed by Order.objects.filter(...).update(status='paid')
              send_confirmation_email(self.user)
              Inventory.objects.filter(product=self.product).update(stock=F('stock') - 1)
    good_example: |
      # correct: orchestration in a service function
      # orders/services.py
      def confirm_order(*, order_id: int) -> Order:
          order = Order.objects.select_for_update().get(id=order_id)
          order.status = "confirmed"
          order.save(update_fields=["status"])
          send_confirmation_email(order.user)
          Inventory.objects.filter(product=order.product).update(stock=F("stock") - 1)
          return order
  - id: logic_in_serializer
    severity: warning
    description: "Business logic, service calls, or database writes are placed inside DRF serializer validate_* methods or the create()/update() methods of ModelSerializer. Serializers should only validate data shape and types — not perform side effects."
    bad_example: |
      # wrong: business logic inside serializer
      class UserSerializer(serializers.ModelSerializer):
          def validate_email(self, value):
              send_verification_email(value)  # side effect in validator
              return value

          def create(self, validated_data):
              user = User(**validated_data)
              user.set_password(validated_data['password'])
              user.save()
              assign_default_role(user)  # business logic in serializer
              return user
    good_example: |
      # correct: serializer validates only; service creates
      class UserCreateApi(APIView):
          class InputSerializer(serializers.Serializer):
              email = serializers.EmailField()
              password = serializers.CharField()

              def validate_email(self, value):
                  if not value.endswith('@company.com'):
                      raise serializers.ValidationError("Must be a company email.")
                  return value  # validation only, no side effects

          def post(self, request):
              s = self.InputSerializer(data=request.data)
              s.is_valid(raise_exception=True)
              user = create_user(**s.validated_data)  # service does the work
              return Response(UserOutputSerializer(user).data)
  - id: signals_for_business_logic
    severity: warning
    description: "Django signals (post_save, pre_delete, m2m_changed) are used to trigger business logic side effects. Signals make data flow implicit — a reader of the service code cannot see that additional actions are triggered. They also fire on bulk operations inconsistently and are difficult to test in isolation."
    bad_example: |
      # wrong: business logic in signal
      @receiver(post_save, sender=Order)
      def on_order_saved(sender, instance, created, **kwargs):
          if created:
              send_confirmation_email(instance.user)
              update_inventory(instance)
    good_example: |
      # correct: explicit orchestration in service
      def create_order(*, user_id: int, product_id: int, quantity: int) -> Order:
          order = Order.objects.create(user_id=user_id, product_id=product_id, quantity=quantity)
          send_confirmation_email(order.user)
          update_inventory(order)
          return order
  - id: raw_queries_in_views
    severity: critical
    description: "ORM queries are written directly inside API view methods or serializers instead of selector functions. This scatters data access logic, makes query reuse impossible, and prevents centralized optimization (select_related, caching)."
    bad_example: |
      # wrong: ORM query in the view
      class UserListApi(APIView):
          def get(self, request):
              users = User.objects.filter(is_active=True).select_related('profile')
              return Response(UserOutputSerializer(users, many=True).data)
    good_example: |
      # correct: selector owns the query
      # users/selectors.py
      def list_active_users():
          return User.objects.filter(is_active=True).select_related("profile")

      # users/apis.py
      class UserListApi(APIView):
          def get(self, request):
              users = list_active_users()
              return Response(UserOutputSerializer(users, many=True).data)

---
