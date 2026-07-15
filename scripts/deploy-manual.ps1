<#
.SYNOPSIS
Deploys the backend application to a remote VM via SSH/SCP.

.DESCRIPTION
This script archives the project directory (excluding node_modules and .git), uploads it to a remote Linux VM over SSH, extracts it, and runs docker compose.
This script is intended for use when the GitHub Actions pipeline is unavailable.

.PARAMETER VM_IP
The IP address of the remote VM.

.PARAMETER VM_USER
The SSH username.

.PARAMETER VM_PORT
The SSH port (default: 22).

.PARAMETER REMOTE_DIR
The directory on the remote VM to deploy to (default: ~/blansole-backend).
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$VM_IP,

    [Parameter(Mandatory=$true)]
    [string]$VM_USER,

    [string]$VM_PORT = "22",
    [string]$REMOTE_DIR = "~/blansole-backend"
)

$ErrorActionPreference = "Stop"

# Create build artifact
$ARCHIVE_NAME = "deploy-archive.tar.gz"
Write-Host "Creating deployment archive..." -ForegroundColor Cyan

# Tar the directory, excluding node_modules, .git, dist, logs
tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='logs' --exclude=$ARCHIVE_NAME -czf $ARCHIVE_NAME .

Write-Host "Upload $ARCHIVE_NAME to $VM_USER@$VM_IP..." -ForegroundColor Cyan
scp -P $VM_PORT $ARCHIVE_NAME ${VM_USER}@${VM_IP}:${REMOTE_DIR}_archive.tar.gz

Write-Host "Extracting and restarting Docker on remote VM..." -ForegroundColor Cyan
ssh -p $VM_PORT ${VM_USER}@${VM_IP} @"
    mkdir -p $REMOTE_DIR
    tar -xzf ${REMOTE_DIR}_archive.tar.gz -C $REMOTE_DIR
    rm ${REMOTE_DIR}_archive.tar.gz
    
    cd $REMOTE_DIR
    echo 'Building and restarting containers...'
    docker compose -f infra/docker-compose.yml up -d --build
"@

Write-Host "Cleaning up local archive..." -ForegroundColor Cyan
Remove-Item $ARCHIVE_NAME

Write-Host "Manual Deployment Successful!" -ForegroundColor Green
