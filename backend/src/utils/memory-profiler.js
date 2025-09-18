/**
 * Memory Profiling Utility
 * Based on Next.js memory debugging guidelines
 * https://nextjs.org/docs/app/guides/memory-usage
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

class MemoryProfiler {
  constructor() {
    this.samples = [];
    this.startTime = Date.now();
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Start memory profiling
   * @param {number} intervalMs - Sampling interval in milliseconds
   * @param {number} durationMs - Total duration to profile
   */
  start(intervalMs = 10000, durationMs = 300000) { // Default: 10s interval, 5min duration
    if (this.isRunning) {
      console.log('📊 Memory profiler is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.samples = [];

    console.log(`🔍 Starting memory profiler for ${durationMs / 1000}s with ${intervalMs / 1000}s intervals`);

    // Take initial sample
    this.takeSample();

    // Set up periodic sampling
    this.intervalId = setInterval(() => {
      this.takeSample();

      // Check if duration exceeded
      if (Date.now() - this.startTime >= durationMs) {
        this.stop();
      }
    }, intervalMs);

    // Auto-stop after duration
    setTimeout(() => {
      if (this.isRunning) {
        this.stop();
      }
    }, durationMs);
  }

  /**
   * Take a memory sample
   */
  takeSample() {
    const timestamp = Date.now();
    const uptime = Math.floor((timestamp - this.startTime) / 1000);

    // Get memory usage
    const memUsage = process.memoryUsage();

    // Get heap statistics (V8 specific)
    const heapStats = process.getHeapCodeStatistics ? process.getHeapCodeStatistics() : {};

    // Calculate percentages
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const externalPercent = memUsage.external ? (memUsage.external / memUsage.heapTotal) * 100 : 0;

    const sample = {
      timestamp,
      uptime,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
        external: memUsage.external ? Math.round(memUsage.external / 1024 / 1024 * 100) / 100 : 0, // MB
        arrayBuffers: memUsage.arrayBuffers ? Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100 : 0, // MB
      },
      percentages: {
        heapUsed: Math.round(heapUsedPercent * 100) / 100,
        external: Math.round(externalPercent * 100) / 100,
      },
      heapStats: {
        codeAndMetadataSize: heapStats.code_and_metadata_size ? Math.round(heapStats.code_and_metadata_size / 1024 / 1024 * 100) / 100 : 0,
        bytecodeAndMetadataSize: heapStats.bytecode_and_metadata_size ? Math.round(heapStats.bytecode_and_metadata_size / 1024 / 1024 * 100) / 100 : 0,
        externalScriptSourceSize: heapStats.external_script_source_size ? Math.round(heapStats.external_script_source_size / 1024 / 1024 * 100) / 100 : 0,
      }
    };

    this.samples.push(sample);

    // Log current sample
    console.log(`📊 Memory Sample #${this.samples.length} (${uptime}s):`);
    console.log(`   RSS: ${sample.memory.rss}MB, Heap: ${sample.memory.heapUsed}MB/${sample.memory.heapTotal}MB (${sample.percentages.heapUsed}%)`);
    console.log(`   External: ${sample.memory.external}MB (${sample.percentages.external}%), ArrayBuffers: ${sample.memory.arrayBuffers}MB`);

    if (sample.percentages.heapUsed > 90) {
      console.warn(`⚠️  HIGH HEAP USAGE: ${sample.percentages.heapUsed}% at ${uptime}s`);
    }

    if (sample.memory.rss > 200) {
      console.warn(`⚠️  HIGH RSS USAGE: ${sample.memory.rss}MB at ${uptime}s`);
    }
  }

  /**
   * Stop memory profiling and generate report
   */
  stop() {
    if (!this.isRunning) {
      console.log('📊 Memory profiler is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('🏁 Stopping memory profiler and generating report...');
    this.generateReport();
  }

  /**
   * Generate detailed memory usage report
   */
  generateReport() {
    if (this.samples.length === 0) {
      console.log('No memory samples collected');
      return;
    }

    const duration = Math.floor((Date.now() - this.startTime) / 1000);

    // Calculate statistics
    const heapUsages = this.samples.map(s => s.memory.heapUsed);
    const heapTotals = this.samples.map(s => s.memory.heapTotal);
    const rssUsages = this.samples.map(s => s.memory.rss);
    const heapPercents = this.samples.map(s => s.percentages.heapUsed);

    const stats = {
      duration: `${duration}s`,
      sampleCount: this.samples.length,
      heap: {
        min: Math.min(...heapUsages),
        max: Math.max(...heapUsages),
        avg: Math.round((heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length) * 100) / 100,
        final: heapUsages[heapUsages.length - 1],
      },
      heapTotal: {
        min: Math.min(...heapTotals),
        max: Math.max(...heapTotals),
        avg: Math.round((heapTotals.reduce((a, b) => a + b, 0) / heapTotals.length) * 100) / 100,
        final: heapTotals[heapTotals.length - 1],
      },
      rss: {
        min: Math.min(...rssUsages),
        max: Math.max(...rssUsages),
        avg: Math.round((rssUsages.reduce((a, b) => a + b, 0) / rssUsages.length) * 100) / 100,
        final: rssUsages[rssUsages.length - 1],
      },
      heapPercent: {
        min: Math.min(...heapPercents),
        max: Math.max(...heapPercents),
        avg: Math.round((heapPercents.reduce((a, b) => a + b, 0) / heapPercents.length) * 100) / 100,
        final: heapPercents[heapPercents.length - 1],
      }
    };

    // Identify potential issues
    const issues = [];
    if (stats.heapPercent.max > 90) {
      issues.push(`High heap usage detected: ${stats.heapPercent.max}% max`);
    }
    if (stats.rss.max > 300) {
      issues.push(`High RSS usage detected: ${stats.rss.max}MB max`);
    }
    if (stats.heap.max - stats.heap.min > 20) {
      issues.push(`High heap volatility: ${stats.heap.max - stats.heap.min}MB range`);
    }

    const report = {
      timestamp: new Date().toISOString(),
      profiling: {
        duration,
        samples: this.samples.length,
        interval: '10s',
      },
      statistics: stats,
      issues: issues.length > 0 ? issues : ['No significant issues detected'],
      samples: this.samples,
    };

    // Save detailed report to file
    const filename = `memory-profile-${Date.now()}.json`;
    const filepath = join(process.cwd(), filename);
    writeFileSync(filepath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n📊 MEMORY PROFILING REPORT');
    console.log('=' .repeat(50));
    console.log(`Duration: ${stats.duration} (${this.samples.length} samples)`);
    console.log('\nHeap Usage:');
    console.log(`  Current: ${stats.heap.final}MB (${stats.heapPercent.final}%)`);
    console.log(`  Min/Max: ${stats.heap.min}MB - ${stats.heap.max}MB`);
    console.log(`  Average: ${stats.heap.avg}MB (${stats.heapPercent.avg}%)`);
    console.log('\nRSS Usage:');
    console.log(`  Current: ${stats.rss.final}MB`);
    console.log(`  Min/Max: ${stats.rss.min}MB - ${stats.rss.max}MB`);
    console.log(`  Average: ${stats.rss.avg}MB`);
    console.log('\nHeap Total:');
    console.log(`  Current: ${stats.heapTotal.final}MB`);
    console.log(`  Min/Max: ${stats.heapTotal.min}MB - ${stats.heapTotal.max}MB`);
    console.log(`  Average: ${stats.heapTotal.avg}MB`);

    if (issues.length > 0) {
      console.log('\n⚠️  ISSUES DETECTED:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('\n✅ No significant memory issues detected');
    }

    console.log(`\n📄 Detailed report saved: ${filename}`);
    console.log('=' .repeat(50));

    return report;
  }

  /**
   * Force garbage collection (if --expose-gc flag is used)
   */
  forceGC() {
    if (global.gc) {
      console.log('🗑️  Forcing garbage collection...');
      global.gc();
      console.log('✅ Garbage collection completed');
      setTimeout(() => this.takeSample(), 1000); // Sample after GC
    } else {
      console.log('⚠️  Garbage collection not available (use --expose-gc flag)');
    }
  }

  /**
   * Get current memory snapshot
   */
  getSnapshot() {
    const memUsage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: memUsage.external ? Math.round(memUsage.external / 1024 / 1024 * 100) / 100 : 0,
      heapPercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100,
    };
  }
}

// Export singleton instance
export const memoryProfiler = new MemoryProfiler();

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Starting 5-minute memory profiling session...');
  memoryProfiler.start(10000, 300000); // 10s interval, 5min duration

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, stopping profiler...');
    memoryProfiler.stop();
    process.exit(0);
  });
}