param(
    [string]$Provider = "deepseek",
    [string]$ApiKey = "sk-b6c2d4a3376e4a2ca6eb4a7f2e0d3a08",
    [string]$BaseUrl = "https://api.deepseek.com/v1/chat/completions",
    [string]$Model = "deepseek-chat"
)

$envContent = @"
# LLM Configuration
LLM_PROVIDER=$Provider

# DeepSeek Configuration
DEEPSEEK_API_KEY=$ApiKey
DEEPSEEK_BASE_URL=$BaseUrl
DEEPSEEK_MODEL=$Model

# OpenAI Configuration
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
"@

$envPath = Join-Path $PSScriptRoot ".env"
Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "Successfully created .env file with $Provider configuration!"
