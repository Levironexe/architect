# Selenium Chaos Suite (C#)

Converted from the TypeScript Selenium fixture into NUnit + Selenium WebDriver.

## Run

```bash
dotnet test
```

## Notes

- Uses a shared driver pattern to mirror the original fixture behavior.
- Defaults to Chrome via `Selenium.WebDriver.ChromeDriver`.
- Environment variables are loaded from `.env` when present.

## Best-Practice Flow

A clean architecture example is included under `src/BestPractices/` and validated by `tests/BestPracticeFlowTests.cs`.

This best-practice path demonstrates:

- Isolated per-test driver session (`WebDriverSession`)
- Explicit waits over fixed sleeps (`UiWait`)
- Layered page objects with focused responsibilities
- Reusable business flow orchestration (`CheckoutFlow`)
