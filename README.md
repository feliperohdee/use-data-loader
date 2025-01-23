# use-data-loader

A TypeScript utility designed to optimize data fetching by batching multiple requests into a single request and caching the results. Perfect for scenarios where you need to avoid request waterfalls and redundant API calls.

[![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/-Vitest-729B1B?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Usage](#usage)
  - [Basic Usage](#basic-usage)
  - [Caching](#caching)
  - [Custom Cache Keys](#custom-cache-keys)
  - [Batch Size Limits](#batch-size-limits)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Testing](#testing)
- [Author](#author)
- [License](#license)

## Installation

```bash
npm install use-data-loader
```

## Features

- 🚀 Automatically batches multiple individual requests into a single request
- 📦 Built-in memory caching to avoid redundant requests
- ⚡ Coalesces duplicate requests happening at the same time
- 🔄 Smart error handling with per-item error resolution
- 💪 Fully typed with TypeScript
- 🎯 Configurable batch sizes for optimal performance
- 🛡️ Comprehensive test coverage

## Why use DataLoader?

DataLoader is designed to solve three main problems:

1. **Request Batching**: Instead of making N API calls for N items, DataLoader batches them into a single request, significantly reducing network overhead.

2. **Request Deduplication**: When your application requests the same resource multiple times simultaneously, DataLoader ensures only one request is made.

3. **Caching**: Results are cached by default, preventing redundant requests for the same data during the request lifecycle.

## Usage

### Basic Usage

```typescript
import DataLoader from 'use-data-loader';

// Create a new loader
const loader = new DataLoader(async keys => {
	// keys is an array of IDs to fetch
	const response = await fetch('/api/items?ids=' + keys.join(','));
	const items = await response.json();

	// Return array must be same length as keys array
	return items;
});

// Load individual items
const item1 = await loader.load('key1');
const item2 = await loader.load('key2');

// Load multiple items
const items = await loader.loadMany(['key1', 'key2', 'key3']);
```

### Caching

```typescript
// Cache is enabled by default
const loader = new DataLoader(batchFn);

// Disable cache if needed
const noCacheLoader = new DataLoader(batchFn, { cache: false });

// Clear single item from cache
loader.clear('key1');

// Clear entire cache
loader.clearAll();

// Prime the cache with known values
loader.prime('key1', value);
```

### Custom Cache Keys

```typescript
const loader = new DataLoader(batchFn, {
	cacheKeyFn: key => key.toLowerCase()
});
```

### Batch Size Limits

```typescript
// Limit maximum batch size for performance tuning
const loader = new DataLoader(batchFn, {
	maxBatchSize: 100
});
```

## API Reference

### Constructor Options

```typescript
type Options<K, V, C = K> = {
	batchScheduleFn?: (callback: () => void) => void;
	cache?: boolean;
	cacheKeyFn?: (key: K) => C;
	maxBatchSize?: number;
};
```

### Methods

- `load(key)`: Load a single value by key
- `loadMany(keys)`: Load multiple values by their keys
- `clear(key)`: Clear a value from cache
- `clearAll()`: Clear the entire cache
- `prime(key, value)`: Prime the cache with a value

## Examples

### REST API Batching

```typescript
const userLoader = new DataLoader(async userIds => {
	const response = await fetch(`/api/users?ids=${userIds.join(',')}`);
	const users = await response.json();

	// Maintain order of userIds in response
	return userIds.map(id => users.find(user => user.id === id));
});
```

### Caching with Custom Keys

```typescript
const itemLoader = new DataLoader(
	async keys => {
		// Fetch items and return them
		return keys.map(k => `Value: ${k}`);
	},
	{
		cacheKeyFn: key => key.toLowerCase(),
		maxBatchSize: 100
	}
);
```

## Testing

The library includes extensive test coverage. Run tests with:

```bash
npm test
```

Test coverage includes:

- Constructor and options validation
- Batch loading and scheduling
- Cache behavior and operations
- Error handling scenarios
- Custom key functions
- Batch size limits
- Edge cases

## 👨‍💻 Author

**Felipe Rohde**

- Twitter: [@felipe_rohde](https://twitter.com/felipe_rohde)
- Github: [@feliperohdee](https://github.com/feliperohdee)
- Email: feliperohdee@gmail.com

## License

[MIT](LICENSE)
