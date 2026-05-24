@echo off
setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0"
set "MAVEN_VERSION=3.9.6"
set "MAVEN_DIR=%PROJECT_DIR%.maven\apache-maven-%MAVEN_VERSION%"
set "MAVEN_ZIP=%PROJECT_DIR%.maven\maven.zip"
set "MVN_BIN=%MAVEN_DIR%\bin\mvn.cmd"

:: Clean up JAVA_HOME if it incorrectly points to the 'bin' folder (e.g. ends in \bin)
if not "%JAVA_HOME%"=="" (
    if exist "%JAVA_HOME%\java.exe" (
        echo [SleekChat] Detected JAVA_HOME points to 'bin' folder. Correcting...
        for %%A in ("%JAVA_HOME%\..") do set "JAVA_HOME=%%~fA"
    )
)

:: Detect and configure JAVA_HOME. Ensure we use JDK 21+ since this project requires Java 21.
set "USE_AUTO_DETECTION=0"
if "%JAVA_HOME%"=="" (
    set "USE_AUTO_DETECTION=1"
) else (
    :: Check if the current JAVA_HOME points to a JDK older than 21
    echo %JAVA_HOME% | findstr /I "jdk-21 jdk-22 jdk-23 jdk-24" >nul
    if errorlevel 1 (
        echo [SleekChat] Warning: Current JAVA_HOME points to a JDK older than 21: %JAVA_HOME%
        echo [SleekChat] Looking for a compatible JDK 21+ installation...
        set "USE_AUTO_DETECTION=1"
    )
)

if "%USE_AUTO_DETECTION%"=="1" (
    :: Look in common JDK installation folders first for JDK 21+
    for /d %%d in ("C:\Program Files\Java\jdk-2*") do (
        set "JAVA_HOME=%%d"
        echo [SleekChat] Found JDK 21+ in Program Files. Setting JAVA_HOME=!JAVA_HOME!
        goto :check_maven
    )
    
    :: Fallback: Try to resolve from the 'java' command in PATH
    for /f "delims=" %%i in ('where java.exe 2^>nul') do (
        set "JAVA_BIN_PATH=%%i"
        for %%A in ("!JAVA_BIN_PATH!") do set "JAVA_BIN_DIR=%%~dpA"
        for %%B in ("!JAVA_BIN_DIR!..") do set "JAVA_HOME=%%~fB"
        echo [SleekChat] Resolved JDK from PATH. Setting JAVA_HOME=!JAVA_HOME!
        goto :check_maven
    )
)

:check_maven
:: Check if Maven is already installed globally
where mvn >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [SleekChat] Global Maven detected. Starting application...
    call mvn spring-boot:run
    exit /b
)

:: If not global, check if we already downloaded portable Maven
if not exist "%MVN_BIN%" (
    echo [SleekChat] Global Maven not detected. Downloading portable Maven %MAVEN_VERSION%...
    if not exist "%PROJECT_DIR%.maven" mkdir "%PROJECT_DIR%.maven"
    
    :: Use PowerShell to download Maven binaries zip file
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://archive.apache.org/dist/maven/maven-3/%MAVEN_VERSION%/binaries/apache-maven-%MAVEN_VERSION%-bin.zip' -OutFile '%MAVEN_ZIP%'"
    
    if not exist "%MAVEN_ZIP%" (
        echo [Error] Failed to download Maven. Please verify your internet connection.
        pause
        exit /b 1
    )
    
    echo [SleekChat] Extracting Maven zip file...
    powershell -Command "Expand-Archive -Path '%MAVEN_ZIP%' -DestinationPath '%PROJECT_DIR%.maven' -Force"
    
    if exist "%MAVEN_ZIP%" del "%MAVEN_ZIP%"
    echo [SleekChat] Portable Maven configured successfully!
)

echo [SleekChat] Starting Spring Boot Application with JAVA_HOME=%JAVA_HOME%...
call "%MVN_BIN%" spring-boot:run
