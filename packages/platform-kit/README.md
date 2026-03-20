# @flowbot/platform-kit

Shared infrastructure for platform connectors: action registry, event forwarding, circuit breaker, and HTTP server factory.

## Usage

```typescript
import {
  ActionRegistry,
  CircuitBreaker,
  EventForwarder,
  createConnectorServer,
  ConnectorError,
} from '@flowbot/platform-kit'
```

## API

**ActionRegistry**: Type-safe action handler registry with Valibot schema validation. Register typed action handlers and execute them with automatic validation.

**CircuitBreaker**: Fault tolerance pattern for external service calls. Manages state transitions (closed → open → half-open) with configurable thresholds and timeouts.

**EventForwarder**: Forwards platform events (messages, member joins, etc.) to the flow engine via HTTP POST requests.

**createConnectorServer**: Hono-based server factory exposing `POST /execute`, `GET /health`, and `GET /actions` endpoints. Integrates ActionRegistry with standardized HTTP contract.

**createServerManager**: Manages HTTP server lifecycle with graceful shutdown.

**ConnectorError**: Custom error class for connector-specific errors with detailed context.

## Testing

```bash
pnpm platform-kit test
```
