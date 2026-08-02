# Assinatura de codigo Windows

As releases do Orion Optimizer exigem uma assinatura Authenticode valida.
`forceCodeSigning` esta ativo no Electron Builder: se nao existir um
certificado configurado, o build de distribuicao falha e nenhum instalador
sem assinatura deve ser publicado.

Para a assinatura baseada num certificado PFX, configura estas variaveis de
ambiente apenas na maquina de release ou no CI:

```powershell
$env:CSC_LINK = 'C:\seguro\orion-optimizer-codesign.pfx'
$env:CSC_KEY_PASSWORD = 'a-password-do-certificado'
```

O certificado tem de ser emitido por uma autoridade raiz confiavel para
assinatura de codigo. Nao uses certificados autoassinados: o Windows trata-os
como nao assinados e eles nao resolvem avisos do SmartScreen ou do Defender.

Depois de configurares o certificado, gera a release normal:

```powershell
npm.cmd run build
npm.cmd run release:publish
```

Antes de publicar, confirma o resultado:

```powershell
Get-AuthenticodeSignature 'release\Orion Optimizer Setup <versao>.exe'
```

O estado tem de ser `Valid` e o emissor tem de corresponder ao publicador
esperado. Se o Microsoft Defender classificar uma build assinada como falsa
positiva, submete o ficheiro como software developer em
https://www.microsoft.com/wdsi/filesubmission.
