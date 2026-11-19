param([ValidateSet('Set','Run','Status')][string]$Action='Status',[ValidateSet('Google','Stripe','Imgbb')][string]$Provider='Google')
$ErrorActionPreference='Stop'
$configFile=Join-Path $env:LOCALAPPDATA 'Equipora/providers.xml'
$allowed=@('GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','IMGBB_API_KEY')
$pointer=[IntPtr]::Zero
$failureCategory='private_provider_configuration_failed'
$stage='load_configuration'
try {
 $values=@{}
 if(Test-Path -LiteralPath $configFile){
  $failureCategory='encrypted_configuration_read_failed'
  $encrypted=Import-Clixml -LiteralPath $configFile
  if($encrypted -isnot [Security.SecureString]){throw 'Invalid encrypted format'}
  $failureCategory='encrypted_configuration_decrypt_failed'
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($encrypted)
  try{$object=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)|ConvertFrom-Json;foreach($property in $object.PSObject.Properties){if($property.Name -notin $allowed){throw 'Unsupported field'};$values[$property.Name]=[string]$property.Value}}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$pointer=[IntPtr]::Zero;$object=$null}
 }
 if($Action -eq 'Set'){
  $names=switch($Provider){'Google'{@('GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET')};'Stripe'{@('STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET')};'Imgbb'{@('IMGBB_API_KEY')}}
  foreach($name in $names){
   $stage='read_'+$name.ToLowerInvariant();$failureCategory='masked_input_read_failed'
   $entry=Read-Host "Enter $name privately (input is hidden)" -AsSecureString
   $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($entry)
   try {
    $value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $stage='validate_'+$name.ToLowerInvariant()
    if([string]::IsNullOrWhiteSpace($value)){$failureCategory='credential_empty';throw 'Rejected'}
    if($value.Length -gt 4096){$failureCategory='credential_too_long';throw 'Rejected'}
    if($value -match '[\r\n\x00]'){$failureCategory='credential_control_character';throw 'Rejected'}
    if($value -ne $value.Trim()){$failureCategory='credential_surrounding_whitespace';throw 'Rejected'}
    if($name -eq 'STRIPE_SECRET_KEY'){
     if($value.StartsWith('sk_live_') -or $value.StartsWith('rk_live_')){$failureCategory='stripe_live_key_forbidden';throw 'Rejected'}
     if($value.StartsWith('rk_test_')){$failureCategory='stripe_restricted_test_key_unsupported';throw 'Rejected'}
     if($value.StartsWith('pk_test_') -or $value.StartsWith('pk_live_')){$failureCategory='stripe_publishable_key_not_secret';throw 'Rejected'}
     if($value -cnotmatch '\A(?:sk_test_|rkcs_test_)[A-Za-z0-9]+\z'){$failureCategory='stripe_test_secret_format_required';throw 'Rejected'}
    }
    if($name -eq 'STRIPE_WEBHOOK_SECRET'-and !$value.StartsWith('whsec_')){$failureCategory='stripe_webhook_secret_format_required';throw 'Rejected'}
    if($name -eq 'GOOGLE_CLIENT_ID'-and !$value.EndsWith('.apps.googleusercontent.com')){$failureCategory='google_client_identifier_format_required';throw 'Rejected'}
    $values[$name]=$value
   }finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$pointer=[IntPtr]::Zero;$entry=$null;$value=$null}
  }
  $stage='save_configuration';$failureCategory='encrypted_configuration_write_failed'
  $null=New-Item -ItemType Directory -Path (Split-Path $configFile) -Force
  $protected=($values|ConvertTo-Json -Compress)|ConvertTo-SecureString -AsPlainText -Force
  $temporary=$configFile+'.pending';$protected|Export-Clixml -LiteralPath $temporary;Move-Item -LiteralPath $temporary -Destination $configFile -Force
  Write-Output ('{"encryptedConfigurationSaved":true,"provider":"'+$Provider+'","valuesPrinted":false}')
 } elseif($Action -eq 'Run'){
  $stage='run_local_api';$failureCategory='local_runner_failed'
  if(!(Test-Path -LiteralPath $configFile)){throw 'Private configuration missing'}
  if($env:EQUIPORA_LOCAL_PROVIDERS){throw 'Existing transient provider environment must be cleared first'}
  $env:EQUIPORA_LOCAL_PROVIDERS=$values|ConvertTo-Json -Compress
  Push-Location (Split-Path $PSScriptRoot)
  try { & node --import tsx scripts/dev-isolated.ts; if($LASTEXITCODE -ne 0){throw 'Local runner failed'} } finally {Pop-Location;Remove-Item Env:EQUIPORA_LOCAL_PROVIDERS -ErrorAction SilentlyContinue}
 } else {
  [pscustomobject]@{encryptedFilePresent=(Test-Path -LiteralPath $configFile);googleConfigured=($values.ContainsKey('GOOGLE_CLIENT_ID')-and $values.ContainsKey('GOOGLE_CLIENT_SECRET'));stripeTestConfigured=($values.ContainsKey('STRIPE_SECRET_KEY')-and $values.ContainsKey('STRIPE_WEBHOOK_SECRET'));imgbbConfigured=$values.ContainsKey('IMGBB_API_KEY');valuesPrinted=$false}|ConvertTo-Json -Compress
 }
} catch {[pscustomobject]@{result='BLOCKED';category=$failureCategory;stage=$stage;valuesSuppressed=$true}|ConvertTo-Json -Compress;exit 1}
finally {if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)};$values=$null;$protected=$null}
