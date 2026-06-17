# Demo en AWS desde cero — guía paso a paso (sin experiencia previa)

Objetivo: tener CertReady **corriendo en AWS** con **todo funcional** (juez con Docker,
ClickHouse/analítica, DSS, web) para la presentación. Una sola VM (EC2) con Docker corre
todo. **Costo ~$1/día**; se **termina** al acabar.

> ⏰ **Haz el paso 0 HOY.** Crear y verificar una cuenta AWS nueva puede tardar de minutos a
> varias horas. No lo dejes para mañana en la mañana.

---

## 0) Crear la cuenta AWS + entender el Free Tier

1. Entra a https://aws.amazon.com/ → **Create an AWS Account**.
2. Necesitas: email, **tarjeta** (hace un cargo de verificación de ~$1 que se reembolsa) y
   un **teléfono** (verificación por SMS/llamada). Elige el plan **Basic (gratis)**.
3. Espera a que la cuenta quede **activa** (a veces llega un correo de confirmación).

**Sobre el "Free Tier" (importante, para no confundirte):**
- **No se "activa" nada**: el free tier se aplica **solo** a recursos *elegibles*, automático,
  durante los primeros **12 meses**. Lo más relevante: **t3.micro** (750 h/mes), **30 GB**
  de disco, 100 GB de salida de datos.
- **Pero la demo usa `t3.medium`** (4 GB de RAM), que **NO es free tier**, porque el stack
  completo + ClickHouse + juez no caben en 1 GB. Por eso la demo **sí cuesta** (~$1/día).
  Es barato y temporal. (El free tier de t3.micro te sirve **después**, p. ej. para dejar
  solo el juez corriendo gratis.)

## 1) Poner un tope de gasto (Budget) — hazlo primero

1. Arriba a la derecha, tu nombre → **Billing and Cost Management**.
2. Menú izquierdo → **Budgets** → **Create budget** → plantilla **Zero spend budget** (o
   un budget de **$5**) → pon tu email → **Create**.
3. Así AWS te **avisa por correo** si empieza a cobrar. (No frena el gasto, solo alerta.)

## 2) Elegir región

Arriba a la derecha hay un selector de región. Elige **N. Virginia (us-east-1)** (la más
barata y la que usan los scripts por defecto). Úsala siempre durante esta demo.

## 3) Lanzar la instancia EC2 (clic a clic)

1. Busca **EC2** en la barra superior → entra → **Launch instance**.
2. **Name**: `certready-demo`.
3. **Application and OS Images**: elige **Ubuntu** → **Ubuntu Server 22.04 LTS** (64-bit x86).
4. **Instance type**: escribe y elige **`t3.medium`**.
5. **Key pair (login)**: **Create new key pair** → nombre `certready` → tipo **RSA** →
   formato **.pem** → **Create** (se **descarga** `certready.pem`; guárdalo, es tu llave).
6. **Network settings** → **Edit**:
   - **Allow SSH traffic** → **My IP** (solo tú entras por SSH).
   - **Add security group rule** → Type **Custom TCP**, **Port 3000**, Source **Anywhere
     (0.0.0.0/0)** (para que la gente abra la web).
7. **Configure storage**: súbelo a **30 GiB** gp3.
8. **Launch instance**. Espera ~1 min a que esté **Running**.
9. Entra a la instancia → copia su **Public IPv4 DNS** (algo como
   `ec2-xx-xx-xx-xx.compute-1.amazonaws.com`). Lo usarás para SSH y para el QR.

## 4) Conectarte por SSH (desde Windows / PowerShell)

En la carpeta donde se descargó `certready.pem`:
```powershell
# arreglar permisos de la llave (Windows lo exige)
icacls .\certready.pem /inheritance:r
icacls .\certready.pem /grant:r "$($env:USERNAME):(R)"

# conectar (usa TU DNS público)
ssh -i .\certready.pem ubuntu@ec2-xx-xx-xx-xx.compute-1.amazonaws.com
```
La primera vez pregunta "Are you sure...?" → escribe **yes**. Ya estás dentro de la VM.

## 5) Instalar dependencias (dentro de la VM, una vez)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker
sudo snap install go --classic
sudo snap install node --classic
sudo apt-get update && sudo apt-get install -y python3-venv python3-pip git
```

## 6) Traer el código (repo privado) y levantar todo

Crea un **token** en GitHub (Settings → Developer settings → Personal access tokens →
**Tokens (classic)** → scope **repo**). Luego, en la VM:
```bash
git clone https://<TU_TOKEN>@github.com/diegomed11/certready.git
cd certready
bash scripts/ec2-up.sh
```
Tarda varios minutos (compila, instala, siembra, corre el ETL). Al final imprime:
```
http://<DNS-PUBLICA>:3000
```

## 7) Probar y hacer el QR

- Abre esa URL en tu navegador (debe cargar la landing/login).
- Pruébala: regístrate, inscríbete en **AWS Solutions Architect Associate**, entra a
  **Estudiar / Exámenes / Entrevistas (corre código) / Progreso**.
- Genera un **QR** de `http://<DNS-PUBLICA>:3000` (cualquier generador) para la presentación.
- Precalienta **"Mi camino"** una vez (la 1ª vez descarga un modelo ~120 MB).

## 8) Costos (qué pagas exactamente)

`us-east-1`, aprox., con la instancia **encendida**:
- **t3.medium**: ~**$0.04/hora** ≈ **$1/día** (~$30/mes si la dejaras todo el mes).
- **Disco 30 GB**: ~$2.4/mes (~$0.08/día).
- **IPv4 pública**: ~$0.005/hora (~$0.12/día).
- **Salida de datos**: 100 GB/mes gratis → en una demo, ~$0.

➡️ **Total demo: ~$1–1.5/día.** Si la enciendes hoy para probar y mañana para presentar y
luego la terminas, son **un par de dólares**.

## 9) Apagar para NO seguir pagando (importante)

Al terminar la demo:
```bash
bash scripts/ec2-down.sh     # detiene el stack dentro de la VM
```
Y en la **consola de AWS** → EC2 → tu instancia → **Instance state**:
- **Stop** = se apaga pero **sigue cobrando el disco** (~$2.4/mes). Úsalo si la quieres
  volver a prender mañana.
- **Terminate** = **borra** la instancia y el disco → **deja de cobrar todo**. Úsalo cuando
  ya no la necesites.

> Truco: si presentas mañana, hoy haz todo y deja la instancia con **Stop**; mañana
> **Start**, verifica la URL, presenta, y al final **Terminate**.

## 10) Para después (free tier de verdad, $0)

Cuando quieras dejar algo corriendo sin pagar: el **juez** cabe en una **t3.micro**
(free tier, $0 por 12 meses); la analítica/ClickHouse se enciende cuando haya presupuesto
(ver `despliegue-aws.md`). Para la **demo de mañana**, lo de arriba (t3.medium) es lo simple
y seguro.

## Notas
- Va en **http** (la cookie de sesión funciona porque la web corre en modo dev). Para
  **https**: apunta un dominio a la IP y pon **Caddy** delante con `next start`.
- Los servicios internos (180xx, 9099, 8123) no se exponen: el Security Group solo abre
  **3000** y **22**.
- Si algo truena al correr `ec2-up.sh`, mira `.devlogs/` y mándame el error.
