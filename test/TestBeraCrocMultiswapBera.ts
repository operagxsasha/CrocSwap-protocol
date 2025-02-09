import { TestPool, makeTokenPool, Token, createWbera, makeMultiswap, makeWberaPool } from './FacadePool'
import "@nomiclabs/hardhat-ethers";
import { ethers } from 'hardhat';
import { solidity } from "ethereum-waffle";
import chai, { expect } from "chai";
import { CrocQuery, WBERA } from '../typechain';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { getCrocErc20LpAddress } from '../misc/utils/getCrocErc20LpAddress';
import { BigNumber } from 'ethers';
import { BeraCrocMultiSwap } from '../contracts/typechain';
import { ZERO_ADDR } from './FixedPoint';

chai.use(solidity);

describe('Test Multiswap with BERA / NATIVE BERA MinAmountOut = 0', () => {
  let test: TestPool
  let baseToken: Token
  let quoteToken: Token
  const feeRate = 28 * 100
  let trader: string
  let query: CrocQuery
  let wbera: WBERA
  let multiswap: BeraCrocMultiSwap

  before(async () => {
    wbera = await createWbera()
  })

  beforeEach("deploy", async () => {
    test = await makeWberaPool(wbera)
    multiswap = await makeMultiswap((await test.dex).address)
  })

  it("deploy & add liquidity & multiswap with native bera WITH SLIPPAGE", async () => {
    baseToken = await test.base
    quoteToken = await test.quote

    const price = 0.0001
    const slippage = 0.01
    const initPoolCallData = await test.initPoolCalldata(feeRate, 0, 16, price)

    const dexWithSigner = await (await test.dex).connect((await test.trader))
    await dexWithSigner['userCmd(uint16,bytes)'](initPoolCallData.pathId, initPoolCallData.calldata)

    const priceLimits = {
      min: price * (1 - (slippage ?? 1) / 100),
      max: price * (1 + (slippage ?? 1) / 100),
    };

    const limits = await test.transformLimits([priceLimits.min, priceLimits.max])
    const initialLiquidity = parseEther('10')

    const mintCalldata = await test.encodeWarmPath(
      test.base.address,
      test.quote.address,
      31,
      0,
      0,
      initialLiquidity,
      limits[0],
      limits[1],
      0,
      await getCrocErc20LpAddress(baseToken.address, quoteToken.address, (await test.dex).address)
    )

    await dexWithSigner['userCmd(uint16,bytes)'](test.WARM_PROXY, mintCalldata)

    const multiswapWithSigner = await multiswap.connect((await test.trader))

    //approve multiswap contract

    await baseToken.fund(await test.trader, multiswap.address, parseEther('10000000000000000'))
    await quoteToken.fund(await test.trader, multiswap.address, parseEther('10000000000000000'))

    const baseTokenAddress = test.base.address === wbera.address ? ZERO_ADDR : test.base.address
    const quoteTokenAddress = test.quote.address === wbera.address ? ZERO_ADDR : test.quote.address


    const previewArgs = [{
      poolIdx: test.poolIdx,
      base: baseToken.address,
      quote: quoteToken.address,
      isBuy: true
    }]

    const previewArgs2 = [{
      poolIdx: test.poolIdx,
      base: baseToken.address,
      quote: quoteToken.address,
      isBuy: false
    }]

    const args = [{
      poolIdx: test.poolIdx,
      base: baseTokenAddress,
      quote: quoteTokenAddress,
      isBuy: true
    }]

    const args2 = [{
      poolIdx: test.poolIdx,
      base: baseTokenAddress,
      quote: quoteTokenAddress,
      isBuy: false
    }]

    const swapSlippage = 0.01
    const s = parseUnits(swapSlippage.toString(), 18)


    // ======= swap 1 ==========
    console.log('SWAP 1')
    const amount = parseEther('0.1')
    let previewAmount = (await multiswapWithSigner.previewMultiSwap([...previewArgs], amount))
    previewAmount = (previewAmount as any)[0]
    console.log('prev amnt', previewAmount)
    let minAmountOut = (previewAmount.sub(previewAmount.mul(s).div(BigNumber.from(10).pow(18))))
    await multiswapWithSigner.multiSwap([...args], amount, minAmountOut, {
      value: amount
    })

    // ======= swap 2 ==========
    console.log('SWAP 2', minAmountOut.toString())
    const newswapamount2 = parseEther('0.001')
    previewAmount = await multiswapWithSigner.previewMultiSwap([...previewArgs2], newswapamount2)
    previewAmount = (previewAmount as any)[0]

    minAmountOut = (previewAmount.sub(previewAmount.mul(s).div(BigNumber.from(10).pow(18))))
    await multiswapWithSigner.multiSwap([...args2], newswapamount2, minAmountOut, {
      value: newswapamount2
    })

    // ======= swap 3 ==========
    console.log('SWAP 3', minAmountOut.toString())
    const newswapamount = parseEther('0.1')
    previewAmount = await multiswapWithSigner.previewMultiSwap([...previewArgs], newswapamount)
    previewAmount = (previewAmount as any)[0]

    minAmountOut = (previewAmount.sub(previewAmount.mul(s).div(BigNumber.from(10).pow(18))))

    await multiswapWithSigner.multiSwap([...args], newswapamount, minAmountOut, {
      value: newswapamount
    })
  })
  it("deploy & add liquidity & multiswap with native bera WITHOUT SLIPPAGE", async () => {
    baseToken = await test.base
    quoteToken = await test.quote

    const price = 0.001
    const slippage = 0.1
    const initPoolCallData = await test.initPoolCalldata(feeRate, 0, 16, price)

    const dexWithSigner = await (await test.dex).connect((await test.trader))
    await dexWithSigner['userCmd(uint16,bytes)'](initPoolCallData.pathId, initPoolCallData.calldata)

    const priceLimits = {
      min: price * (1 - (slippage ?? 1) / 100),
      max: price * (1 + (slippage ?? 1) / 100),
    };

    const limits = await test.transformLimits([priceLimits.min, priceLimits.max])
    const initialLiquidity = parseEther('100')

    const mintCalldata = await test.encodeWarmPath(
      test.base.address,
      test.quote.address,
      31,
      0,
      0,
      initialLiquidity,
      limits[0],
      limits[1],
      0,
      await getCrocErc20LpAddress(baseToken.address, quoteToken.address, (await test.dex).address)
    )

    await dexWithSigner['userCmd(uint16,bytes)'](test.WARM_PROXY, mintCalldata)

    const multiswapWithSigner = await multiswap.connect((await test.trader))

    //approve multiswap contract

    await baseToken.fund(await test.trader, multiswap.address, parseEther('1000'))
    await quoteToken.fund(await test.trader, multiswap.address, parseEther('1000'))

    // const args = [36000,baseToken.address,quoteToken.address,true] as any

    const baseTokenAddress = test.base.address === wbera.address ? ZERO_ADDR : test.base.address
    const quoteTokenAddress = test.quote.address === wbera.address ? ZERO_ADDR : test.quote.address


    const args = [{
      poolIdx: test.poolIdx,
      base: baseTokenAddress,
      quote: quoteTokenAddress,
      isBuy: true
    }]

    const args2 = [{
      poolIdx: test.poolIdx,
      base: baseTokenAddress,
      quote: quoteTokenAddress,
      isBuy: false
    }]


    console.log("args", args)
    const amount = parseEther('1')
    await multiswapWithSigner.multiSwap([...args], amount, 0, {
      value: amount
    })
    await multiswapWithSigner.multiSwap([...args2], amount, 0, {
      value: amount
    })
    await multiswapWithSigner.multiSwap([...args], amount, 0, {
      value: amount
    })

  })

})
