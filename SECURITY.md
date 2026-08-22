# Security policy

## Supported releases

Security fixes are provided for the latest published release of Trash Tests.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability. Use the repository's private vulnerability-reporting channel when it is available, or contact the repository maintainer privately with the following information:

1. A clear description of the issue.
2. Reproduction steps or a proof of concept.
3. The potential impact.
4. Any suggested mitigations.

Please allow time for investigation and coordinated remediation before public disclosure.

## Data handling

Trash Tests performs static analysis of files available in the local workspace or CI runner. It does not upload source code or test files, and it does not execute the test suite as part of its analysis. When coverage is supplied, the tool reads the generated coverage report.

## Dependencies

The project uses pinned JavaScript dependencies managed with pnpm. Dependency updates and automated verification are part of the repository's continuous integration workflow.
