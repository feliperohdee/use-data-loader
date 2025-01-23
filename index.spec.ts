import { describe, expect, it, vi } from 'vitest';
import DataLoader from './index';

describe('/index', () => {
	describe('constructor', () => {
		it('should create a new instance with default options', () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			};
			const loader = new DataLoader(batchFn);
			expect(loader).toBeInstanceOf(DataLoader);
		});

		it('should throw error if batchLoadFn is not a function', () => {
			try {
				new DataLoader({} as any);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('must be constructed with a function');
			}

			try {
				new DataLoader(null as any);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('must be constructed with a function');
			}
		});

		it('should accept custom options', () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			};
			const cacheKeyFn = (key: number) => {
				return `key-${key}`;
			};
			const loader = new DataLoader(batchFn, {
				cache: false,
				maxBatchSize: 5,
				cacheKeyFn
			});
			expect(loader).toBeInstanceOf(DataLoader);
		});

		it('should throw error for invalid maxBatchSize', () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			};

			try {
				new DataLoader(batchFn, { maxBatchSize: 0 });
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('maxBatchSize must be a positive number');
			}

			try {
				new DataLoader(batchFn, { maxBatchSize: -1 });
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('maxBatchSize must be a positive number');
			}

			try {
				new DataLoader(batchFn, { maxBatchSize: 'invalid' as any });
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('maxBatchSize must be a positive number');
			}
		});
	});

	describe('load', () => {
		it('should load a single value', async () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			};
			const loader = new DataLoader(batchFn);
			const result = await loader.load(2);
			expect(result).toBe(4);
		});

		it('should batch multiple loads', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const [a, b, c] = await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);

			expect(a).toBe(2);
			expect(b).toBe(4);
			expect(c).toBe(6);
			expect(batchFn).toHaveBeenCalledTimes(1);
			expect(batchFn).toHaveBeenCalledWith([1, 2, 3]);
		});

		it('should cache repeated loads', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const [a1, b1] = await Promise.all([loader.load(1), loader.load(2)]);
			const [a2, b2] = await Promise.all([loader.load(1), loader.load(2)]);

			expect(a1).toBe(2);
			expect(b1).toBe(4);
			expect(a2).toBe(2);
			expect(b2).toBe(4);
			expect(batchFn).toHaveBeenCalledTimes(1);
		});

		it('should handle errors for individual keys', async () => {
			const error = new Error('test error');
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => {
					return k === 2 ? error : k * 2;
				});
			};
			const loader = new DataLoader(batchFn);

			const [a, b] = await Promise.all([loader.load(1), loader.load(2).catch(e => e)]);

			expect(a).toBe(2);
			expect(b).toBe(error);
		});

		it('should respect maxBatchSize', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn, { maxBatchSize: 2 });

			await Promise.all([loader.load(1), loader.load(2), loader.load(3), loader.load(4)]);

			expect(batchFn).toHaveBeenCalledTimes(2);
			expect(batchFn.mock.calls[0][0]).toHaveLength(2);
			expect(batchFn.mock.calls[1][0]).toHaveLength(2);
		});

		it('should handle null/undefined keys', async () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			};
			const loader = new DataLoader(batchFn);

			try {
				await loader.load(null as any);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('must be called with a value');
			}

			try {
				await loader.load(undefined as any);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('must be called with a value');
			}
		});
	});

	describe('loadMany', () => {
		it('should load multiple values', async () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			};
			const loader = new DataLoader(batchFn);
			const results = await loader.loadMany([1, 2, 3]);
			expect(results).toEqual([2, 4, 6]);
		});

		it('should handle mixed success and errors', async () => {
			const error = new Error('test error');
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => (k === 2 ? error : k * 2));
			};
			const loader = new DataLoader(batchFn);

			const results = await loader.loadMany([1, 2, 3]);
			expect(results[0]).toBe(2);
			expect(results[1]).toBe(error);
			expect(results[2]).toBe(6);
		});

		it('should throw error for invalid input', async () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			};
			const loader = new DataLoader(batchFn);

			try {
				await loader.loadMany(null as any);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('must be called with key[]');
			}

			try {
				await loader.loadMany({} as any);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('must be called with key[]');
			}
		});
	});

	describe('clear and clearAll', () => {
		it('should clear single key from cache', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const a1 = await loader.load(1);
			loader.clear(1);
			const a2 = await loader.load(1);

			expect(a1).toBe(2);
			expect(a2).toBe(2);
			expect(batchFn).toHaveBeenCalledTimes(2);
		});

		it('should clear all keys from cache', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const [a1, b1] = await Promise.all([loader.load(1), loader.load(2)]);
			loader.clearAll();
			const [a2, b2] = await Promise.all([loader.load(1), loader.load(2)]);

			expect(a1).toBe(2);
			expect(b1).toBe(4);
			expect(a2).toBe(2);
			expect(b2).toBe(4);
			expect(batchFn).toHaveBeenCalledTimes(2);
		});
	});

	describe('prime', () => {
		it('should prime the cache with a value', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			loader.prime(1, 2);
			const value = await loader.load(1);

			expect(value).toBe(2);
			expect(batchFn).not.toHaveBeenCalled();
		});

		it('should prime the cache with a promise', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			loader.prime(1, Promise.resolve(2));
			const value = await loader.load(1);

			expect(value).toBe(2);
			expect(batchFn).not.toHaveBeenCalled();
		});

		it('should prime the cache with an error', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);
			const error = new Error('test error');

			loader.prime(1, error);
			const result = await loader.load(1).catch(e => e);

			expect(result).toBe(error);
			expect(batchFn).not.toHaveBeenCalled();
		});

		it('should not override existing values in cache', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const originalValue = await loader.load(1);
			loader.prime(1, 999);
			const primedValue = await loader.load(1);

			expect(originalValue).toBe(2);
			expect(primedValue).toBe(2);
			expect(batchFn).toHaveBeenCalledTimes(1);
		});
	});

	describe('custom cacheKeyFn', () => {
		it('should use custom cache key function', async () => {
			const batchFn = vi.fn(async (keys: readonly string[]) => {
				return keys.map(k => k.toUpperCase());
			});
			const cacheKeyFn = (key: string) => {
				return key.toLowerCase();
			};
			const loader = new DataLoader(batchFn, { cacheKeyFn });

			const [a1, b1] = await Promise.all([loader.load('A'), loader.load('a')]);

			expect(a1).toBe('A');
			expect(b1).toBe('A');
			expect(batchFn).toHaveBeenCalledTimes(1);
		});
	});

	describe('custom batchScheduleFn', () => {
		it('should use custom batch schedule function', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const batchScheduleFn = vi.fn(callback => {
				return setTimeout(callback, 0);
			});
			const loader = new DataLoader(batchFn, { batchScheduleFn });

			const promises = Promise.all([loader.load(1), loader.load(2)]);
			expect(batchScheduleFn).toHaveBeenCalledTimes(1);

			const results = await promises;
			expect(results).toEqual([2, 4]);
		});
	});

	describe('batch function errors', () => {
		it('should handle batch function returning wrong size array', async () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.slice(1).map(k => k * 2);
			};
			const loader = new DataLoader(batchFn);

			try {
				await Promise.all([loader.load(1), loader.load(2)]);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('did not return a Promise of an Array of the same length');
			}
		});

		it('should handle batch function returning non-array', async () => {
			const batchFn = async () => {
				return 'not an array' as any;
			};
			const loader = new DataLoader(batchFn);

			try {
				await loader.load(1);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('did not return a Promise of an Array');
			}
		});

		it('should handle batch function throwing error', async () => {
			const error = new Error('batch error');
			const batchFn = async () => {
				throw error;
			};
			const loader = new DataLoader(batchFn);

			try {
				await loader.load(1);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBe(error);
			}
		});

		it('should handle multiple errors in batch', async () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => new Error(`Error for key ${k}`));
			};
			const loader = new DataLoader(batchFn);

			try {
				await Promise.all([loader.load(1), loader.load(2), loader.load(3)]);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err.message).toBe('Error for key 1');
			}
		});

		it('should clear cache on batch error', async () => {
			const error = new Error('batch error');
			let shouldError = true;

			const batchFn = vi.fn(async (keys: readonly number[]) => {
				if (shouldError) {
					shouldError = false;
					throw error;
				}
				return keys.map(k => k * 2);
			});

			const loader = new DataLoader(batchFn);

			try {
				await loader.load(1);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBe(error);
			}

			// Second attempt should work and not use cache
			const result = await loader.load(1);
			expect(result).toBe(2);
			expect(batchFn).toHaveBeenCalledTimes(2);
		});
	});

	describe('batch scheduling', () => {
		it('should coalesce identical requests', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const [a, b] = await Promise.all([loader.load(1), loader.load(1)]);

			expect(a).toBe(2);
			expect(b).toBe(2);
			expect(batchFn).toHaveBeenCalledTimes(1);
			expect(batchFn).toHaveBeenCalledWith([1]);
		});

		it('should handle max batch size', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn, { maxBatchSize: 2 });

			const [a, b, c, d] = await Promise.all([loader.load(1), loader.load(2), loader.load(3), loader.load(4)]);

			expect(a).toBe(2);
			expect(b).toBe(4);
			expect(c).toBe(6);
			expect(d).toBe(8);
			expect(batchFn).toHaveBeenCalledTimes(2);
			expect(batchFn.mock.calls[0][0]).toEqual([1, 2]);
			expect(batchFn.mock.calls[1][0]).toEqual([3, 4]);
		});

		it('should handle zero pending requests', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const batch = (loader as any).getCurrentBatch();
			await (loader as any).dispatchBatch(batch);

			expect(batchFn).not.toHaveBeenCalled();
		});
	});

	describe('cache behavior', () => {
		it('should cache primitive keys', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const [a1, b1] = await Promise.all([loader.load(1), loader.load(2)]);
			const [a2, b2] = await Promise.all([loader.load(1), loader.load(2)]);

			expect(a1).toBe(2);
			expect(b1).toBe(4);
			expect(a2).toBe(2);
			expect(b2).toBe(4);
			expect(batchFn).toHaveBeenCalledTimes(1);
		});

		it('should handle custom cache key function', async () => {
			const batchFn = vi.fn(async (keys: readonly string[]) => {
				return keys.map(k => k.toUpperCase());
			});
			const loader = new DataLoader(batchFn, {
				cacheKeyFn: key => key.toLowerCase()
			});

			const [a1, b1] = await Promise.all([loader.load('A'), loader.load('a')]);
			const [a2, b2] = await Promise.all([loader.load('A'), loader.load('a')]);

			expect(a1).toBe('A');
			expect(b1).toBe('A');
			expect(a2).toBe('A');
			expect(b2).toBe('A');
			expect(batchFn).toHaveBeenCalledTimes(1);
		});

		it('should prime the cache with promises', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			loader.prime(1, Promise.resolve(2));
			const value = await loader.load(1);

			expect(value).toBe(2);
			expect(batchFn).not.toHaveBeenCalled();
		});

		it('should prime the cache with error values', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);
			const error = new Error('test error');

			loader.prime(1, error);
			try {
				await loader.load(1);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBe(error);
			}
			expect(batchFn).not.toHaveBeenCalled();
		});

		it('should not override cached promises', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const promise = loader.load(1);
			loader.prime(1, 3);
			const value = await promise;

			expect(value).toBe(2);
			expect(batchFn).toHaveBeenCalledTimes(1);
		});

		it('should clear single key from cache', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const a1 = await loader.load(1);
			loader.clear(1);
			const a2 = await loader.load(1);

			expect(a1).toBe(2);
			expect(a2).toBe(2);
			expect(batchFn).toHaveBeenCalledTimes(2);
		});

		it('should clear all keys from cache', async () => {
			const batchFn = vi.fn(async (keys: readonly number[]) => {
				return keys.map(k => k * 2);
			});
			const loader = new DataLoader(batchFn);

			const [a1, b1] = await Promise.all([loader.load(1), loader.load(2)]);
			loader.clearAll();
			const [a2, b2] = await Promise.all([loader.load(1), loader.load(2)]);

			expect(a1).toBe(2);
			expect(b1).toBe(4);
			expect(a2).toBe(2);
			expect(b2).toBe(4);
			expect(batchFn).toHaveBeenCalledTimes(2);
		});
	});

	describe('error handling', () => {
		it('should handle rejections in batch', async () => {
			const error = new Error('test error');
			const batchFn = async () => {
				throw error;
			};
			const loader = new DataLoader(batchFn);

			try {
				await Promise.all([loader.load(1), loader.load(2)]);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBe(error);
			}
		});

		it('should handle mixed errors and values in batch', async () => {
			const error = new Error('test error');
			const batchFn = async (keys: readonly number[]) => {
				return keys.map(k => (k === 2 ? error : k * 2));
			};
			const loader = new DataLoader(batchFn);

			const [value1, error2, value3] = await Promise.all([loader.load(1), loader.load(2).catch(e => e), loader.load(3)]);

			expect(value1).toBe(2);
			expect(error2).toBe(error);
			expect(value3).toBe(6);
		});

		it('should handle invalid batch function results', async () => {
			const batchFn = async () => {
				return null as any;
			};
			const loader = new DataLoader(batchFn);

			try {
				await loader.load(1);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('Promise of an Array');
			}
		});

		it('should handle batch function returning wrong size', async () => {
			const batchFn = async (keys: readonly number[]) => {
				return keys.slice(1).map(k => k * 2);
			};
			const loader = new DataLoader(batchFn);

			try {
				await Promise.all([loader.load(1), loader.load(2)]);
				throw new Error('Expected to throw');
			} catch (err) {
				expect(err).toBeInstanceOf(TypeError);
				expect(err.message).toContain('same length as the Array of keys');
			}
		});
	});
});
