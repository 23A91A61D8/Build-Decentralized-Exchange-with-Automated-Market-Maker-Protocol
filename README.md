<<<<<<< HEAD
# DEX AMM Project

## Overview
This project implements a simplified **Decentralized Exchange (DEX)** using an **Automated Market Maker (AMM)** model similar to Uniswap V2.  
It enables decentralized token trading without order books by using liquidity pools and mathematical pricing.  
Users can add liquidity, remove liquidity, swap tokens, and earn trading fees as liquidity providers.

The project is built using **Solidity**, **Hardhat**, **Docker**, and **OpenZeppelin** contracts.

---

## Features
- Initial and subsequent liquidity provision  
- Liquidity removal with proportional share calculation  
- Token swaps using constant product formula (x * y = k)  
- 0.3% trading fee for liquidity providers  
- LP token minting and burning (tracked internally)

---

## Architecture
The system consists of two smart contracts:

### DEX.sol
- Core AMM and DEX logic  
- Manages reserves, swaps, liquidity, and fees  
- Tracks liquidity providers using internal LP accounting  
- Emits events for liquidity addition, removal, and swaps  

### MockERC20.sol
- Simple ERC-20 token used for testing  
- Allows minting tokens for test scenarios  

Design decisions:
- LP tokens are managed internally using mappings instead of a separate ERC-20 LP token contract  
- Explicit reserve tracking is used to ensure accurate AMM calculations  
- Solidity 0.8+ is used to leverage built-in overflow and underflow protection  

---

## Mathematical Implementation

### Constant Product Formula
The AMM follows the constant product rule:

x * y = k

Where:
- `x` = reserve of Token A  
- `y` = reserve of Token B  
- `k` = constant value  

After each swap, reserves are updated such that `k` never decreases.  
Due to trading fees, `k` slightly increases over time, benefiting liquidity providers.

---

### Fee Calculation
A **0.3% trading fee** is applied to every swap.

Formula used:
amountInWithFee = amountIn * 997
numerator = amountInWithFee * reserveOut
denominator = (reserveIn * 1000) + amountInWithFee
amountOut = numerator / denominator


- 0.3% of the input amount stays in the pool  
- Fees accumulate in reserves  
- Liquidity providers earn fees proportionally  

---

### LP Token Minting

**Initial Liquidity (First Provider):**
liquidityMinted = sqrt(amountA * amountB)
- First provider sets the initial price ratio  

**Subsequent Liquidity Providers:**
liquidityMinted = (amountA * totalLiquidity) / reserveA
- Liquidity must follow the existing price ratio  
- LP share represents ownership of the pool  

---

## Setup Instructions

### Prerequisites
- Docker and Docker Compose installed  
- Git installed  

---

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd dex-amm

2. Start Docker environment:
docker-compose up -d

3.Compile contracts:
docker-compose exec app npm run compile

4.Run tests:
docker-compose exec app npm test

5.Check coverage:
docker-compose exec app npm run coverage

6.Stop Docker:
docker-compose down
=============================
