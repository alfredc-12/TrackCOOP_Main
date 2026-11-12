"""Summarize JMeter CSV HTTP samples in a fixed steady-state window.

Usage: python summarize.py INPUT.jtl START_EPOCH_MS OUTPUT.json
Samples must start at or after START and finish by START+300 seconds. A JMeter
label beginning J01 through J10 identifies an HTTP sampler; other labels,
including login and transaction parents, are excluded from these metrics.
Never use this script to replace or alter the original JTL.
"""
import csv
import json
import math
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

WINDOW_MS = 300_000
GROUP = re.compile(r'^(J(?:0[1-9]|10))(?:\b|[_: -])')


def metrics(rows):
    times = sorted(r['elapsed'] for r in rows)
    n = len(rows)
    if not n:
        return {'samples': 0, 'status': 'Not Evaluated'}
    percentile = lambda p: times[math.ceil(p * n) - 1]
    failed = sum(not r['success'] for r in rows)
    return {
        'samples': n, 'successful': n - failed, 'unexpected_failed': failed,
        'min_ms': times[0], 'max_ms': times[-1],
        'mean_ms': statistics.fmean(times), 'median_ms': statistics.median(times),
        'p90_ms': percentile(.90), 'p95_ms': percentile(.95),
        'p99_ms': percentile(.99), 'population_stddev_ms': statistics.pstdev(times),
        'throughput_http_per_second': n / (WINDOW_MS / 1000),
        'unexpected_error_rate_percent': failed * 100 / n,
        'received_bytes': sum(r['bytes'] for r in rows),
        'sampled_threads_min': min(r['threads'] for r in rows),
        'sampled_threads_max': max(r['threads'] for r in rows),
    }


def summarize(filename, start):
    groups = defaultdict(list)
    excluded = defaultdict(int)
    with open(filename, newline='', encoding='utf-8-sig') as source:
        reader = csv.DictReader(source)
        required = {'timeStamp', 'elapsed', 'label', 'success', 'bytes', 'allThreads'}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f'Missing required JTL columns: {sorted(missing)}')
        for row in reader:
            match = GROUP.match(row['label'])
            if not match:
                excluded['non_group_label'] += 1
                continue
            ts, elapsed = int(row['timeStamp']), int(row['elapsed'])
            if ts < start or ts + elapsed > start + WINDOW_MS:
                excluded['outside_or_crossing_window'] += 1
                continue
            value = row['success'].lower()
            if value not in ('true', 'false') or elapsed < 0:
                raise ValueError('Invalid success or elapsed value')
            groups[match.group(1)].append({'elapsed': elapsed, 'success': value == 'true',
                'bytes': int(row['bytes']), 'threads': int(row['allThreads'])})
    combined = [sample for entries in groups.values() for sample in entries]
    return {'window_start_epoch_ms': start, 'window_duration_seconds': WINDOW_MS / 1000,
        'sample_boundary': 'start >= window start AND completion <= window end',
        'percentile': 'nearest rank, ceil(p*n), one-indexed',
        'expected_rejections': 'none configured; failed assertions and HTTP failures count as unexpected',
        'thread_observation_limit': 'sampled concurrency only; cannot establish continuous thread activity',
        'excluded_counts': dict(excluded), 'overall': metrics(combined),
        'groups': {f'J{i:02}': metrics(groups[f'J{i:02}']) for i in range(1, 11)}}


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    result = summarize(sys.argv[1], int(sys.argv[2]))
    target = Path(sys.argv[3])
    if target.exists():
        raise SystemExit('Refusing to overwrite existing summary')
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
