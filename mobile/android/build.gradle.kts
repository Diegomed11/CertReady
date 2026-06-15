allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Algunos plugins (file_picker → flutter_plugin_android_lifecycle) exigen
// compileSdk >= 36. El SDK de Flutter de este proyecto trae 34 por defecto y el
// plugin de Flutter fija el compileSdk de cada módulo en su propio bloque android{},
// así que hay que sobreescribirlo en afterEvaluate (corre después). Se omite :app,
// que ya está evaluado a esta altura y ya fija compileSdk 36 en su build.gradle.kts.
subprojects {
    if (name != "app") {
        afterEvaluate {
            extensions.findByName("android")?.withGroovyBuilder {
                "compileSdkVersion"(36)
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
