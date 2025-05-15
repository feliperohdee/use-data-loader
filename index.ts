import defer from 'lodash/defer';
import forEach from 'lodash/forEach';
import identity from 'lodash/identity';
import isArrayLike from 'lodash/isArrayLike';
import isFunction from 'lodash/isFunction';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import map from 'lodash/map';
import size from 'lodash/size';

namespace DataLoader {
	export type Batch<K, V> = {
		cacheHits?: (() => void)[];
		hasDispatched: boolean;
		promises: {
			resolve: (value: V) => void;
			reject: (err: Error) => void;
		}[];
		keys: K[];
	};

	export type BatchLoadFn<K, V> = (keys: K[]) => Promise<(V | Error)[]>;
	export type Options<K, C = K> = {
		batchScheduleFn?: (callback: () => void) => void;
		cache?: boolean;
		cacheKeyFn?: (key: K) => C;
		maxBatchSize?: number;
	};
}

class DataLoader<K, V, C = K> {
	private batch: DataLoader.Batch<K, V> | null = null;
	private batchLoadFn: DataLoader.BatchLoadFn<K, V>;
	private batchScheduleFn: (callback: () => void) => void;
	private cacheKeyFn: (key: K) => C;
	private cacheMap: Map<C, Promise<V>> | null;
	private maxBatchSize: number;

	constructor(batchLoadFn: DataLoader.BatchLoadFn<K, V>, options: DataLoader.Options<K, C> = {}) {
		if (!isFunction(batchLoadFn)) {
			throw new TypeError(
				'DataLoader must be constructed with a function which accepts ' + `key[] and returns Promise<value[]>, but got: ${batchLoadFn}.`
			);
		}

		this.batchLoadFn = batchLoadFn;
		this.batchScheduleFn = options.batchScheduleFn ?? defer;
		this.cacheKeyFn = options.cacheKeyFn ?? (identity as (key: K) => C);
		this.cacheMap = options.cache !== false ? new Map() : null;
		this.maxBatchSize = this.validateMaxBatchSize(options.maxBatchSize);
	}

	async load(key: K): Promise<V> {
		if (isNil(key)) {
			throw new TypeError('The loader.load() function must be called with a value, ' + `but got: ${String(key)}.`);
		}

		const batch = this.getCurrentBatch();
		const cacheKey = this.cacheKeyFn(key);

		if (this.cacheMap) {
			const cached = this.cacheMap.get(cacheKey);

			if (cached) {
				if (!batch.cacheHits) {
					batch.cacheHits = [];
				}

				return new Promise(resolve => {
					batch.cacheHits!.push(() => {
						return resolve(cached);
					});
				});
			}
		}

		batch.keys.push(key);

		const promise = new Promise<V>((resolve, reject) => {
			batch.promises.push({ resolve, reject });
		});

		if (this.cacheMap) {
			this.cacheMap.set(cacheKey, promise);
		}

		return promise;
	}

	async loadMany(keys: K[]): Promise<(V | Error)[]> {
		if (!this.isArrayLike(keys)) {
			throw new TypeError('The loader.loadMany() function must be called with key[] ' + `but got: ${String(keys)}.`);
		}

		return Promise.all(
			map(keys, async key => {
				try {
					return await this.load(key);
				} catch (err) {
					return err as Error;
				}
			})
		);
	}

	clear(key: K): this {
		if (this.cacheMap) {
			const cacheKey = this.cacheKeyFn(key);
			this.cacheMap.delete(cacheKey);
		}

		return this;
	}

	clearAll(): this {
		if (this.cacheMap) {
			this.cacheMap.clear();
		}

		return this;
	}

	prime(key: K, value: V | Promise<V> | Error): this {
		const cacheMap = this.cacheMap;

		if (cacheMap) {
			const cacheKey = this.cacheKeyFn(key);

			if (cacheMap.get(cacheKey) === undefined) {
				let promise: Promise<V>;
				if (value instanceof Error) {
					promise = Promise.reject(value);
					// Prevent unhandled rejection
					promise.catch(() => {});
				} else {
					promise = Promise.resolve(value);
				}
				cacheMap.set(cacheKey, promise);
			}
		}

		return this;
	}

	private getCurrentBatch(): DataLoader.Batch<K, V> {
		if (this.batch && !this.batch.hasDispatched && size(this.batch.keys) < this.maxBatchSize) {
			return this.batch;
		}

		const newBatch: DataLoader.Batch<K, V> = {
			hasDispatched: false,
			promises: [],
			keys: []
		};

		this.batch = newBatch;
		this.batchScheduleFn(() => {
			this.dispatchBatch(newBatch);
		});

		return newBatch;
	}

	private async dispatchBatch(batch: DataLoader.Batch<K, V>) {
		batch.hasDispatched = true;

		if (size(batch.keys) === 0) {
			this.resolveCacheHits(batch);
			return;
		}

		try {
			const values = await this.batchLoadFn(batch.keys);

			if (!this.isArrayLike(values)) {
				throw new TypeError(
					'DataLoader must be constructed with a function which accepts ' +
						'key[] and returns Promise<value[]>, but the function did ' +
						`not return a Promise of an Array: ${String(values)}.`
				);
			}

			if (size(values) !== size(batch.keys)) {
				throw new TypeError(
					'DataLoader must be constructed with a function which accepts ' +
						'key[] and returns Promise<value[]>, but the function did ' +
						'not return a Promise of an Array of the same length as the Array ' +
						'of keys.' +
						`\n\nKeys:\n${String(batch.keys)}` +
						`\n\nValues:\n${String(values)}`
				);
			}

			this.resolveCacheHits(batch);

			forEach(batch.promises, (promise, i) => {
				const value = values[i];

				if (value instanceof Error) {
					promise.reject(value);
				} else {
					promise.resolve(value);
				}
			});
		} catch (err) {
			// Handle batch failure
			this.resolveCacheHits(batch);

			forEach(batch.keys, (key, i) => {
				this.clear(key);
				batch.promises[i].reject(err as Error);
			});
		}
	}

	private resolveCacheHits(batch: DataLoader.Batch<K, V>) {
		if (batch.cacheHits) {
			forEach(batch.cacheHits, callback => {
				callback();
			});
		}
	}

	private validateMaxBatchSize(size: number | undefined): number {
		if (isNil(size)) {
			return Infinity;
		}

		if (!isNumber(size) || size < 1) {
			throw new TypeError(`maxBatchSize must be a positive number: ${size}`);
		}

		return size;
	}

	private isArrayLike(x: any): boolean {
		return isArrayLike(x);
	}
}

export default DataLoader;
