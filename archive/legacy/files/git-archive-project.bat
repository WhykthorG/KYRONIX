@echo off
echo Compactando projeto usando git-archive ^(ignora .gitignore perfeitamente^)...

git archive --format=zip --output=project.zip HEAD

if %errorlevel% equ 0 (
  echo ✅ project.zip criado! ^(apenas arquivos tracked pelo git^)
  for %%F in (project.zip) do echo Tamanho: %%~zF bytes
) else (
  echo ❌ git-archive falhou. Certifique-se de que ha commits no repo.
)

pause
