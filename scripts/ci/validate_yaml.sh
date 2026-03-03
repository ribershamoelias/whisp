#!/usr/bin/env bash
set -euo pipefail

ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml")'
ruby -e 'require "yaml"; YAML.load_file("tasks/phase1.yaml")'

echo "YAML validation passed"
