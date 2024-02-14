import { TestPool, makeTokenPool, Token } from './FacadePool'
import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers } from 'hardhat';
import { toSqrtPrice, fromSqrtPrice, maxSqrtPrice, minSqrtPrice } from './FixedPoint';
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { MockERC20 } from '../typechain/MockERC20';
import { BigNumber, ContractTransaction } from 'ethers';
import { TransactionResponse } from '@ethersproject/providers';

chai.use(solidity);

describe('Pool Swap', () => {
    let test: TestPool
    let baseToken: Token
    let quoteToken: Token
    let failed: boolean

    beforeEach("deploy",  async () => {
       test = await makeTokenPool()
       baseToken = await test.base
       quoteToken = await test.quote

       await test.initPool(0, 0, 1, 1.0)

       await test.fundTokens(BigNumber.from(2).pow(127))
       test.useHotPath = true
       failed = false
    })

    it("swap over max", async() => {
        await test.testMintAmbient(10)

        try {
            await test.testSwap(true, true, BigNumber.from(2).pow(120), BigNumber.from(2).pow(127))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap over max output fixed", async() => {
        await test.testMintAmbient(10)
        try {
            await test.testSwap(true, false, BigNumber.from("10000000"), BigNumber.from(2).pow(127))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap under min", async() => {
        await test.testMintAmbient(10)

        try {
            await test.testSwap(false, false, BigNumber.from(2).pow(120), BigNumber.from(2).pow(2))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap under min output fixed", async() => {
        await test.testMintAmbient(10)
        try {
            await test.testSwap(false, true, BigNumber.from("10000000"), BigNumber.from(2).pow(2))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap over max 1 wei", async() => {
        await test.testMintAmbient(10)

        try {
            await test.testSwap(true, true, BigNumber.from(2).pow(120), maxSqrtPrice().add(1))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap over max output fixed 1 wei", async() => {
        await test.testMintAmbient(10)
        try {
            await test.testSwap(true, false, BigNumber.from("10000000"), maxSqrtPrice().add(1))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap under min 1 wei", async() => {
        await test.testMintAmbient(10)

        try {
            await test.testSwap(false, false, BigNumber.from(2).pow(120), minSqrtPrice().sub(1))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap under min output fixed 1 wei", async() => {
        await test.testMintAmbient(10)
        try {
            await test.testSwap(false, true, BigNumber.from("10000000"), minSqrtPrice().sub(1))
        } catch (error: any) {
            failed = true
            expect(error.message).to.include("out of gas"); // Check if the error message contains "out of gas"
        }
        expect(failed).to.eq(true)
    })

    it("swap to max", async() => {
        await test.testMintAmbient(10)

        await test.snapStart()
        await test.testSwap(true, true, BigNumber.from(2).pow(120), maxSqrtPrice())

        expect(await test.liquidity()).to.equal(10*1024)

        let price = await test.price()
        expect(price).to.eq(maxSqrtPrice())
    
        const liqMult = await test.liquidity(false)
        const priceInit = toSqrtPrice(1.0)
        const priceDiff = maxSqrtPrice().sub(priceInit)
        const baseFlow = liqMult.mul(priceDiff.shr(64))
        const quoteFlow = liqMult.shl(64).div(priceInit).mul(-1)
        expect(await test.snapBaseFlow()).to.gt(baseFlow)
        expect(await test.snapQuoteFlow()).to.gt(quoteFlow)
    })

    it("swap to max fixed Output", async() => {
        await test.testMintAmbient(10)

        await test.snapStart()
        await test.testSwap(true, false, BigNumber.from(2).pow(120), maxSqrtPrice())

        expect(await test.liquidity()).to.equal(10*1024)

        let price = await test.price()
        expect(price).to.eq(maxSqrtPrice())
    
        const liqMult = await test.liquidity(false)
        const priceInit = toSqrtPrice(1.0)
        const priceDiff = maxSqrtPrice().sub(priceInit)
        const baseFlow = liqMult.mul(priceDiff.shr(64))
        const quoteFlow = liqMult.shl(64).div(priceInit).mul(-1)
        expect(await test.snapBaseFlow()).to.gt(baseFlow)
        expect(await test.snapQuoteFlow()).to.gt(quoteFlow)
    })

    it("swap to min", async() => {
        await test.testMintAmbient(10)

        await test.snapStart()
        await test.testSwap(false, false, BigNumber.from(2).pow(120), minSqrtPrice())

        expect(await test.liquidity()).to.equal(10*1024)

        let price = await test.price()
        expect(price).to.eq(minSqrtPrice())
    
        const liqMult = await test.liquidity(false)
        const priceInit = toSqrtPrice(1.0)
        const priceDiff = maxSqrtPrice().sub(priceInit)
        const baseFlow = liqMult.mul(priceDiff.shr(64)).mul(-1)
        const quoteFlow = liqMult.shl(64).div(priceInit)
        expect(await test.snapBaseFlow()).to.gt(baseFlow)
        expect(await test.snapQuoteFlow()).to.gt(quoteFlow)
    })

    it("swap to min fixed output", async() => {
        await test.testMintAmbient(10)

        await test.snapStart()
        await test.testSwap(false, true, BigNumber.from(2).pow(120), minSqrtPrice())

        expect(await test.liquidity()).to.equal(10*1024)

        let price = await test.price()
        expect(price).to.eq(minSqrtPrice())
    
        const liqMult = await test.liquidity(false)
        const priceInit = toSqrtPrice(1.0)
        const priceDiff = maxSqrtPrice().sub(priceInit)
        const baseFlow = liqMult.mul(priceDiff.shr(64)).mul(-1)
        const quoteFlow = liqMult.shl(64).div(priceInit)
        expect(await test.snapBaseFlow()).to.gt(baseFlow)
        expect(await test.snapQuoteFlow()).to.gt(quoteFlow)
    })
})
