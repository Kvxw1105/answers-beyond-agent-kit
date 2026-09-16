param(
  [ValidateSet('auto','codex','claude','opencode','cursor','generic')]
  [string]$Harness = 'auto',
  [string]$ApiUrl = 'https://ent.xince.work'
)

$ErrorActionPreference = 'Stop'

if (-not $env:ABEC_API_KEY) {
  $secret = Read-Host '粘贴成员后台生成的 ABEC API Key（输入不会显示）' -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    [Environment]::SetEnvironmentVariable('ABEC_API_KEY', $plain, 'User')
    $env:ABEC_API_KEY = $plain
  }
  finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $plain = $null
  }
}

npx --yes 'github:Kvxw1105/answers-beyond-agent-kit#v1.2.0' setup --harness $Harness --api-url $ApiUrl --register
npx --yes 'github:Kvxw1105/answers-beyond-agent-kit#v1.2.0' doctor --check
