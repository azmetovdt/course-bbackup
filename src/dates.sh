#!/bin/bash
for f in /home/ohstapit/Documents/backupped/*; do 
    echo $f\\0$(date -r "$f" "+%Y-%m-%dT%H:%M:%S"); 
    done