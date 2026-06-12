# Project Overview: babelfish-babelfish (babelfish-webrtc-ui)

App to interface with the babelfish-backend webrtc app

## Project Structure

- `/app`: Contains root.tsx and routes.ts routes
- `/app/lib`: Utility functions and helper modules.
- `/app/routes`: 
- `/docs`: For related documentation
- `/public`: Static assets like images and fonts.
- `/tests`: Contains Application testcases

## Technology Stack

### Libraries and Frameworks

- **React 19.2** - UI Library
- **React Router 7.9** - routing
- **TypeScript 5.9** - language
- **Vite 6.3** - build tool
- **Tailwind CSS 4.1** - CSS framework

### Testing 

- **Vitest 3.2** - Vite-based test runner
- **@vitest/browser** - testing environment for browser based tests
- **Playwright 1.56** - browser automation/testing

### Development Tools

- **Biome** - code formatter
- **Oxlint** - eslint compatable code linter
- **pnpm** - package manager

## Development Commands

Available commands:

- `pnpm pre_install`: Install the playwright browser.
- `pnpm dev`: Start the development server (with HMR valid).
- `pnpm build`: build for production use.
- `pnpm start`: Start the built server.
- `pnpm lint`: perform oxlint checks.
- `pnpm lint:strict`: perform oxlint checks, treating warnings as errors.
- `pnpm format`: format code using biome.
- `pnpm format:check`: perform format code 'check'.
- `pnpm typecheck`: perform type check on code base.
- `pnpm test`: run ALL tests
- `pnpm test:cov`: run ALL tests with coverage report.
- `pnpm check`: Perform typecheck, tests and formating.


## Styling Guidelines

- Primarily use Tailwind CSS utility classes for styling.
- Ensure responsiveness across various screen sizes.

## Testing Setup

`pnpm` is used to execute vitest to run testcases.

```bash
# 特定のプロジェクトのみ実行
pnpm vitest --project=unit     # ユニットテストのみ
pnpm vitest --project=browser  # ブラウザテストのみ
```

### Test file naming scheme

- `tests/*.unit.test.{ts,tsx}` - For nodejs focused unit tests
- `tests/*.browser.test.{ts,tsx}` - for browser based unittests using `playwright'
