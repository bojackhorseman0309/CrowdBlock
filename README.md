# CrowdBlock

Proyecto académico para el curso de Blockchain

## 1. Descripción del sistema

**CrowdBlock** es una DApp de crowdfunding donde una persona publica campañas con:
- Meta de recaudación
- Fecha límite

Las personas donantes envían fondos por medio de una criptomoneda directamente al smart contract.  
El contrato aplica reglas automáticas:
- La persona creadora puede retirar fondos solo si la campaña alcanzó la meta y no se retiró antes.
- Si la campaña finaliza sin alcanzar la meta, cada donante puede solicitar el reembolso de su aporte.

El objetivo es demostrar transparencia, trazabilidad e inmutabilidad en el proceso de recaudación por medio de la tecnología blockchain, sin intermediarios ni custodia de fondos por parte de terceros a diferencia de plataformas conocidas como IndieGogo o Kickstarter.

## 2. Arquitectura de la solución

![Diagrama de arquitectura de la DApp CrowdBlock](docs/img/crowdBlockArchitecture.png)

La arquitectura de CrowdBlock se basa en un modelo de DApp por capas, donde el usuario interactúa desde el navegador con un frontend web que actúa como cliente de la aplicación. Para operaciones de
escritura en blockchain, el frontend solicita la firma de la transacción en MetaMask, y una vez aprobada, esta se envía mediante un proveedor RPC hacia la red EVM (Hardhat en desarrollo local o
Polygon Amoy para su despliegue de prueba), donde el smart contract ejecuta las reglas de negocio y actualiza el estado on-chain. Para operaciones de lectura, el frontend consulta estado y eventos directamente por RPC
sin requerir firma. Esta separación entre lectura y escritura mejora la claridad del flujo, mantiene la seguridad en la custodia de claves y permite desplegar el frontend como aplicación estática en
infraestructura de nube sin comprometer la lógica crítica, que permanece en el contrato inteligente.

### Capas
- **Frontend Web (DApp):** interfaz de usuario para crear campañas, donar, retirar y pedir reembolso.
- **Wallet (MetaMask):** firma de transacciones del usuario.
- **Smart Contract (Solidity):** lógica de negocio y estado en blockchain.
- **Red Blockchain:** Hardhat local y Polygon Amoy Testnet.

## 3. Flujo de transacciones

![Diagrama de flujo de transacciones de CrowdBlock](docs/img/transactionDiagram.png)

El diagrama de flujo de transacciones de CrowdBlock representa, en carriles separados, la interacción entre Usuario, Frontend, MetaMask, RPC, Blockchain y Smart Contract. Se detallan los cuatro
flujos principales del sistema: creación de campaña, donación, retiro de fondos por meta alcanzada y reembolso por meta no cumplida. En cada flujo se observa el camino de éxito (firma, propagación,
ejecución y confirmación on-chain) y el camino de error cuando la firma es rechazada o una validación del contrato falla (revert). Además, se incluye el flujo de lectura de estado y eventos, el cual
no requiere firma del wallet.

### Flujo A: Crear campaña
1. La persona creadora completa formulario (`title`, `goal`, `deadline`).
2. MetaMask firma la transacción.
3. El contrato ejecuta una función para crear una campaña `createCampaign()`.
4. Se valida que `goal > 0` y `deadline` sea futura.
5. Se registra la campaña y se emite evento `CampaignCreated`.

### Flujo B: Donar fondos
1. La persona donante selecciona campaña y monto.
2. MetaMask firma transacción con valor (`msg.value`).
3. El contrato ejecuta `donate(campaignId)`.
4. Se valida que la campaña esté activa y dentro de plazo.
5. Se actualiza `amountRaised` y aporte acumulado del donante.
6. Se emite evento `DonationReceived`.

### Flujo C: Retirar fondos cuando se cumple la meta
1. La persona creadora solicita retiro.
2. MetaMask firma la transacción.
3. El contrato ejecuta `withdraw(campaignId)`.
4. Se valida:
   - Quien llama es la persona creadora.
   - `amountRaised >= goal`.
   - No se retiró antes.
5. Se marca `withdrawn = true` y se transfieren fondos.
6. Se emite evento `FundsWithdrawn`.

### Flujo D: Reembolso (meta no cumplida)
1. La persona donante solicita reembolso.
2. MetaMask firma la transacción.
3. El contrato ejecuta `refund(campaignId)`.
4. Se valida:
   - Fecha límite alcanzada.
   - `amountRaised < goal`.
   - Donante tiene saldo aportado > 0.
5. Se pone su aporte en cero y se transfiere reembolso.
6. Se emite evento `RefundIssued`.

## 4. Componentes del sistema

![Diagrama de componentes de la DApp CrowdBlock](docs/img/crowdBlockComponents.png)

### Componente 1: Usuario (Creador/Donador)
- Interactúa con la DApp.
- Autoriza operaciones con wallet.

### Componente 2: Frontend DApp
- Muestra campañas y estados.
- Prepara llamadas al contrato y lectura de eventos.
- No custodia fondos en sí.

### Componente 3: MetaMask
- Gestiona cuentas y llaves.
- Firma transacciones.
- Envía transacciones a la red.

### Componente 4: Smart Contract
- Mantiene estado de campañas y aportes.
- Aplica reglas de negocio.
- Emite eventos para trazabilidad.

### Componente 5: Blockchain (Hardhat / Polygon Amoy)
- Ejecuta EVM y persiste el estado.
- Garantiza inmutabilidad y auditoría de transacciones.

## 5. Modelo de datos propuesto

Estructura base de campaña:
- `id`
- `creator`
- `title`
- `goal`
- `deadline`
- `amountRaised`
- `withdrawn`

Estructura de aportes:
- `contributions[campaignId][donor] => amount`

## 6. Estructura base del repositorio inicial

```txt
CrowdBlock/
  contracts/
    Crowdfunding.sol
  scripts/
    deploy.ts
  web/
    (frontend de la DApp)...
  README.md
```
