fn main() {
    #[cfg(target_os = "windows")]
    {
        // El manifiesto de admin se registra a través de tauri_build (no con
        // winres por separado): dos pasadas de compilación de recursos en el
        // mismo build script generan dos bloques VERSION y el linker de MSVC
        // falla con LNK1123 "duplicate resource".
        let manifest = r#"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <!-- Activa Common Controls v6 — necesario para TaskDialogIndirect en todas las versiones de Windows -->
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}"/><!-- Windows 7 -->
      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}"/><!-- Windows 8 -->
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}"/><!-- Windows 8.1 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/><!-- Windows 10/11 -->
    </application>
  </compatibility>
</assembly>
"#;
        let windows = tauri_build::WindowsAttributes::new().app_manifest(manifest);
        let attrs = tauri_build::Attributes::new().windows_attributes(windows);
        tauri_build::try_build(attrs).expect("fallo en tauri_build con manifiesto de Windows");
    }

    #[cfg(not(target_os = "windows"))]
    {
        tauri_build::build();
    }
}
