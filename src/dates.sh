#!/bin/bash
for f in $(find /home/ohstapit/Documents/backupped -name '*'); do 
    echo $f $(date -r $f "+%Y-%m-%dT%H:%M:%S"); 
    done