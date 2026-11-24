fn main() {
    // tauri_build vigila tauri.conf.json, pero NO los archivos de icono. Sin
    // esta linea, regenerar los iconos no provoca recompilacion: cargo no ve
    // ningun cambio, no vuelve a ejecutar este script, y el ejecutable se queda
    // con el icono que ya tenia embebido.
    //
    // Paso de verdad: el 24/11 el icono llevaba dos dias corregido y la ventana
    // seguia enseñando el logo del nombre VIEJO, porque otto.exe era del 22/11
    // y nada le habia dicho a cargo que tenia que rehacerlo. El acceso directo
    // se veia bien porque apunta a la app instalada, que la compila GitHub
    // desde cero y por tanto siempre coge los iconos del momento.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
