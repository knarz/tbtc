import expectThrow from './helpers/expectThrow'
import increaseTime from './helpers/increaseTime'
import {
  createSnapshot,
  restoreSnapshot,
} from './helpers/snapshot'

const BN = require('bn.js')
const utils = require('./utils')
const chai = require('chai')
const expect = chai.expect
const bnChai = require('bn-chai')
chai.use(bnChai(BN))

const TBTCSystem = artifacts.require('TBTCSystem')

const KeepRegistryStub = artifacts.require('KeepRegistryStub')
const ECDSAKeepVendorStub = artifacts.require('ECDSAKeepVendorStub')

const DepositFunding = artifacts.require('DepositFunding')
const DepositLiquidation = artifacts.require('DepositLiquidation')
const DepositRedemption = artifacts.require('DepositRedemption')
const DepositUtils = artifacts.require('DepositUtils')
const DepositStates = artifacts.require('DepositStates')
const TBTCConstants = artifacts.require('TBTCConstants')
const TestDeposit = artifacts.require('TestDeposit')

const TEST_DEPOSIT_DEPLOY = [
  { name: 'DepositFunding', contract: DepositFunding },
  { name: 'DepositLiquidation', contract: DepositLiquidation },
  { name: 'DepositRedemption', contract: DepositRedemption },
  { name: 'DepositUtils', contract: DepositUtils },
  { name: 'DepositStates', contract: DepositStates },
  { name: 'TBTCConstants', contract: TBTCConstants },
  { name: 'TestDeposit', contract: TestDeposit },
]

contract.only('TBTCSystem', (accounts) => {
  let tbtcSystem
  let ecdsaKeepVendor

  describe('requestNewKeep()', async () => {
    before(async () => {
      await utils.deploySystem(TEST_DEPOSIT_DEPLOY)

      ecdsaKeepVendor = await ECDSAKeepVendorStub.new()

      const keepRegistry = await KeepRegistryStub.new()
      await keepRegistry.setVendor(ecdsaKeepVendor.address)

      tbtcSystem = await TBTCSystem.new(utils.address0)

      await tbtcSystem.initialize(
        keepRegistry.address
      )
    })

    it('sends caller as owner to open new keep', async () => {
      const expectedKeepOwner = accounts[2]

      await tbtcSystem.requestNewKeep(5, 10, { from: expectedKeepOwner })
      const keepOwner = await ecdsaKeepVendor.keepOwner.call()

      assert.equal(expectedKeepOwner, keepOwner, 'incorrect keep owner address')
    })

    it('returns keep address', async () => {
      const expectedKeepAddress = await ecdsaKeepVendor.keepAddress.call()

      const result = await tbtcSystem.requestNewKeep.call(5, 10)

      assert.equal(expectedKeepAddress, result, 'incorrect keep address')
    })
  })

  describe('setSignerFeeDivisor', async () => {
    it('sets the signer fee', async () => {
      await tbtcSystem.setSignerFeeDivisor(new BN('201'))

      const signerFeeDivisor = await tbtcSystem.getSignerFeeDivisor()
      expect(signerFeeDivisor).to.eq.BN(new BN('201'))
    })

    it('reverts if msg.sender != owner', async () => {
      await expectThrow(
        tbtcSystem.setSignerFeeDivisor(new BN('201'), { from: accounts[1] }),
        ''
      )
    })
  })

  describe('emergencyPauseNewDeposits', async () => {
    beforeEach(async () => {
      await createSnapshot()
    })

    afterEach(async () => {
      await restoreSnapshot()
    })

    it('pauses new deposit creation', async () => {
      await tbtcSystem.emergencyPauseNewDeposits()

      const allowNewDeposits = await tbtcSystem.getAllowNewDeposits()
      expect(allowNewDeposits).to.equal(false)
    })

    it('allows new deposit creation after 10 days', async () => {
      await tbtcSystem.emergencyPauseNewDeposits()
      await increaseTime(new BN(864000)) // 10 days
      tbtcSystem.resumeNewDeposits()
      const allowNewDeposits = await tbtcSystem.getAllowNewDeposits()
      expect(allowNewDeposits).to.equal(true)
    })

    it('reverts if emergencyPauseNewDeposits has already been called', async () => {
      await tbtcSystem.emergencyPauseNewDeposits()
      await increaseTime(new BN(864000)) // 10 days
      tbtcSystem.resumeNewDeposits()

      await expectThrow(
        tbtcSystem.emergencyPauseNewDeposits(),
        'emergencyPauseNewDeposits can only be called once'
      )
    })
  })
})
