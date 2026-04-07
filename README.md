# CrowdBlock

Plataforma descentralizada de crowdfunding para crear campañas, recibir aportes y ejecutar retiros/reembolsos con reglas transparentes en blockchain.

## 1. Descripción del sistema

**CrowdBlock** es una DApp de crowdfunding donde una persona publica campañas con:
- Meta de recaudación
- Fecha límite

Las personas donantes envían fondos en **token nativo** directamente al smart contract (**ETH** en Hardhat local y **POL** en Polygon Amoy).  
El contrato aplica reglas automáticas:
- La persona creadora puede retirar fondos solo si la campaña alcanzó la meta, ya venció el plazo y no se retiró antes.
- Si la campaña finaliza sin alcanzar la meta, cada donante puede solicitar el reembolso de su aporte.

El objetivo es ofrecer una alternativa de financiamiento colectivo para usuarios reales, con transparencia, trazabilidad e inmutabilidad, sin intermediarios que custodien los fondos (a diferencia de plataformas tradicionales).

Para simplificar la primera versión, los aportes se manejan con token nativo de la red (ETH en local, POL en Amoy) y se deja como extensión futura el soporte de tokens **ERC-20**.

## 2. Arquitectura de la solución

![Diagrama de arquitectura de la DApp CrowdBlock](docs/img/crowdBlockArchitecture.png)

La arquitectura de CrowdBlock se basa en un modelo de DApp por capas, donde el usuario interactúa desde el navegador con un frontend web que actúa como cliente de la aplicación. Para operaciones de
escritura en blockchain, el frontend solicita la firma de la transacción en MetaMask y luego la envía por RPC hacia la red EVM, donde el smart contract ejecuta las reglas de negocio y actualiza el estado on-chain.
Para operaciones de lectura, el frontend consulta estado y eventos directamente por RPC sin requerir firma. Esta separación entre lectura y escritura mejora la claridad del flujo, mantiene la seguridad en la
custodia de claves y permite desplegar el frontend como aplicación estática sin mover la lógica crítica fuera del contrato inteligente.

En desarrollo local con Hardhat, el RPC es local (por ejemplo `http://127.0.0.1:8545`) y no requiere Infura.  
En Amoy (testnet), puede usarse un proveedor RPC público o servicios como Infura/Alchemy.

### Capas
- **Frontend Web (DApp):** interfaz de usuario para crear campañas, donar, retirar y pedir reembolso.
- **Wallet (MetaMask):** firma de transacciones del usuario.
- **Smart Contract (Solidity):** lógica de negocio y estado en blockchain.
- **Red Blockchain:** Hardhat local y Polygon Amoy Testnet.

## 3. Flujo de transacciones

![Diagrama de flujo de transacciones de CrowdBlock](docs/img/transactionDiagram.png)

El diagrama de flujo de transacciones de CrowdBlock representa, en carriles separados, la interacción entre Usuario, Frontend, MetaMask, RPC, Blockchain y Smart Contract. Se detallan los cuatro
flujos principales del sistema: creación de campaña, donación, retiro de fondos por meta alcanzada y reembolso por meta no cumplida. El énfasis está en el camino funcional principal y en las
validaciones de permisos y estado del contrato (por ejemplo, quién puede retirar fondos y en qué condiciones). Además, se incluye el flujo de lectura de estado y eventos, el cual no requiere firma del wallet.

### Flujo A: Crear campaña
1. La persona creadora completa formulario (`title`, `goal`, `deadline`).
2. MetaMask firma la transacción.
3. El contrato ejecuta una función para crear una campaña `createCampaign()`.
4. Se valida que `goal > 0`, `deadline` sea futura y que el creador registrado sea `msg.sender`.
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
   - Fecha límite alcanzada.
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
   - Donante (`msg.sender`) tiene saldo aportado > 0.
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

## 6. Funcionamiento de Owner

El contrato define un `owner` explícito desde el constructor:
- `constructor(address initialOwner)`

Funciones de administración:
- `transferOwnership(address newOwner)`: transfiere propiedad del contrato.
- `recoverStuckFunds(address payable to, uint256 amount)`: permite al owner recuperar fondos bloqueados.

Restricción:
- Ambas funciones son exclusivas de `owner`.

## 7. Desarrollo de Smart Contracts

### Estructura implementada para Parte 2

```txt
CrowdBlock/
  contracts/
    Crowdfunding.sol
  test/
    Crowdfunding.test.ts
  scripts/
    deploy-local.ts
    demo-local.ts
  hardhat.config.ts
  package.json
  tsconfig.json
  .env.example
  web/
    (frontend de la DApp)...
  README.md
```

### Utilización

Requisitos:
- Node.js 22+
- npm

Secrets:
- Seguir ejemplo de .env.example
- AMOY_RPC_URL: URL RPC para Polygon Amoy Testnet (si se va a desplegar en Amoy)
- DEPLOYER_PRIVATE_KEY: Clave privada de cuenta para desplegar

Instalación de dependencias:
```bash
npm install
```

Compilar contrato:
```bash
npm run compile
```

Ejecutar pruebas:
```bash
npm run test
```

Levantar blockchain local Hardhat:
```bash
npm run node
```

En otra terminal, desplegar contrato en red local:
```bash
npm run deploy:local
```

En otra terminal, ejecutar demo local (crear campaña, donar, retirar):
```bash
npm run demo:local
```

### Configuración de MetaMask

#### Red local Hardhat

1. En MetaMask, agregar red manual:
- Nombre: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Símbolo: `ETH`

2. Importar una cuenta de Hardhat:
- Ejecutar `npm run node` y copiar una private key de las cuentas impresas.
- En MetaMask: `Add account` -> `Import account` -> pegar private key.

3. Seleccionar red `Hardhat Local` antes de usar la UI local.

#### Red Amoy

1. Seleccionar `Polygon Amoy (80002)` en MetaMask.
2. Usar una cuenta con POL de testnet para gas.
3. Si la transacción falla por gas bajo, subir manualmente:
- Max priority fee: `30 gwei`
- Max fee: `80 gwei`

#### Notas para tomar en cuenta

- Si cambias de red en MetaMask, la app recarga automáticamente para evitar errores de provider.
- Después de conectar wallet, siempre presionar `Cargar contrato` si cambiaste dirección o red.
- En local, la UI usa una dirección por defecto de Hardhat. En Amoy, puedes usar la dirección por defecto o pegar una nueva dirección desplegada.

## 8. UI Web con MetaMask

1. Levantar blockchain local:
```bash
npm run node
```

2. En otra terminal, desplegar contrato local:
```bash
npm run deploy:local
```

3. En otra terminal, levantar servidor web de la DApp:
```bash
npm run ui:crowdfunding
```

4. Abrir en navegador:
```txt
http://127.0.0.1:3000
```

5. Flujo de todas las características del UI:
- Conectar MetaMask.
- Cargar contrato.
- Para red local se usa dirección por defecto de Hardhat.
- Para Amoy, pegar la dirección desplegada en el campo de contrato y presionar `Cargar contrato`.
- Probar las cuatro operaciones: crear campaña, donar, retirar y reembolsar.
- Validar sección de administración:
  - visualizar owner actual
  - transferir owner (`transferOwnership`)
  - recuperar fondos bloqueados (`recoverStuckFunds`)
- Verificar que los botones de administración se habilitan solo cuando la cuenta conectada es owner.
- Verificar paginación de campañas (`Anterior` / `Siguiente`) cuando hay más de 5 campañas.
- Revisar lista de donadores por campaña (`getDonators`).
- Validar mensajes de error (permisos, campaign activa, goal no alcanzada, etc.).
- Usar botón `Reset UI` para limpiar direcciones almacenadas y reiniciar estado visual.

## 9. Despliegue del contrato en Polygon Amoy

```bash
npm run amoy:crowdfunding:deploy
```

El script de despliegue:
- valida variables de entorno (`AMOY_RPC_URL`, `DEPLOYER_PRIVATE_KEY`)
- valida que el RPC sea de Amoy (`chainId 80002`)
- despliega `Crowdfunding`
- guarda un registro en `deployments/amoy-crowdfunding.json`

## 10. Prueba de la DApp en Amoy

1. Correr servidor de UI:
```bash
npm run ui:crowdfunding
```

2. Abrir `http://127.0.0.1:3000`
3. Conectar MetaMask y seleccionar red `Polygon Amoy (80002)`
4. Cargar contrato (la UI usa dirección por defecto de Amoy, editable si se redepliega)
5. Validar los flujos:
- crear campaña
- donar fondos
- retirar fondos (si meta alcanzada y deadline vencido)
- reembolsar (si meta no alcanzada y deadline vencido)
- funciones de owner (`transferOwnership`, `recoverStuckFunds`)
