#!/bin/bash
set -e

cd ~/"Library/Application Support/Voracious"
cp voracious.db voracious-backup-`date +%Y%m%d%H%M%S`.db
