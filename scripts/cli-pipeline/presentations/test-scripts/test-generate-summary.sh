#!/bin/bash

TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/cli-pipeline/presentations/test-generate-summary.ts "$@"
