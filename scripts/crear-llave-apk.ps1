# Crea la llave fija con la que CI firma el APK de Android y la guarda como
# secretos del repo (ANDROID_KEYSTORE_BASE64 y ANDROID_KEYSTORE_PASSWORD).
# Se corre UNA sola vez. Si la llave cambia, el celular vuelve a pedir desinstalar.
$ErrorActionPreference = 'Stop'
$repo = 'Airdel/monmoncafe_frontend'
$dir = Join-Path $env:USERPROFILE 'monmoncafe-llave-apk'
$ks = Join-Path $dir 'monmoncafe.keystore'

$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = 'C:\Program Files\GitHub CLI\gh.exe' }
if (-not (Test-Path $gh)) { throw 'No encontre gh (GitHub CLI).' }

if (Test-Path $ks) { throw "Ya existe $ks. No la reemplazo para no cambiar la firma." }
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$buf = New-Object byte[] 24; $rng.GetBytes($buf)
$pw = [Convert]::ToBase64String($buf) -replace '[+/=]', 'x'

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$req = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest(
    'CN=Monmoncafe, O=Monmoncafe, C=MX', $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$cert = $req.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddYears(30))
$cert.FriendlyName = 'monmoncafe'
[IO.File]::WriteAllBytes($ks, $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $pw))
Set-Content -Path (Join-Path $dir 'contrasena.txt') -Value $pw

[Convert]::ToBase64String([IO.File]::ReadAllBytes($ks)) | & $gh secret set ANDROID_KEYSTORE_BASE64 --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'gh no pudo guardar ANDROID_KEYSTORE_BASE64 (prueba: gh auth login).' }
$pw | & $gh secret set ANDROID_KEYSTORE_PASSWORD --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'gh no pudo guardar ANDROID_KEYSTORE_PASSWORD.' }

Write-Host "Listo. Secretos guardados en $repo." -ForegroundColor Green
Write-Host "Respaldo de la llave en $dir (guardala, no la compartas)."
