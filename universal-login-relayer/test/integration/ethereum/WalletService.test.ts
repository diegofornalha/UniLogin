import {createKeyPair, EMPTY_DEVICE_INFO, ETHER_NATIVE_TOKEN, TEST_GAS_PRICE} from '@universal-login/commons';
import {encodeInitializeWithENSData, WalletContractInterface} from '@universal-login/contracts';
import chai, {expect} from 'chai';
import {createMockProvider, getWallets} from 'ethereum-waffle';
import {Contract, providers, utils, Wallet} from 'ethers';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import ENSService from '../../../src/integration/ethereum/ensService';
import {WalletDeploymentService} from '../../../src/integration/ethereum/WalletDeploymentService';
import setupWalletService, {createFutureWallet} from '../../testhelpers/setupWalletService';

chai.use(require('chai-string'));
chai.use(sinonChai);

describe('INT: WalletService', async () => {
  let walletService: WalletDeploymentService;
  let provider: providers.Provider;
  let wallet: Wallet;
  let callback: sinon.SinonSpy;
  let walletContract: Contract;
  let factoryContract: Contract;
  let ensService: ENSService;
  const keyPair = createKeyPair();
  const ensName = 'alex.mylogin.eth';
  let transaction: utils.Transaction;
  let fakeDevicesService: any;

  before(async () => {
    provider = createMockProvider();
    [wallet] = getWallets(provider);
    ({walletService, callback, factoryContract, ensService, provider, fakeDevicesService} = await setupWalletService(wallet));
    const {futureContractAddress, signature} = await createFutureWallet(keyPair, ensName, factoryContract, wallet, ensService);
    transaction = await walletService.deploy({publicKey: keyPair.publicKey, ensName, gasPrice: TEST_GAS_PRICE, signature, gasToken: ETHER_NATIVE_TOKEN.address}, EMPTY_DEVICE_INFO);
    walletContract = new Contract(futureContractAddress, WalletContractInterface, provider);
  });

  describe('Create', async () => {
    it('is initialized with management key', async () => {
      expect(await walletContract.keyCount()).to.eq(1);
      expect(await walletContract.keyExist(keyPair.publicKey)).to.eq(true);
    });

    it('has ENS name reserved', async () => {
      expect(await provider.resolveName(ensName)).to.eq(walletContract.address);
    });

    it('should emit created event', async () => {
      expect(callback).to.be.calledWith(sinon.match({transaction}));
    });

    it('should fail with not existing ENS name', async () => {
      const creationPromise = walletService.deploy({publicKey: wallet.address, ensName: 'alex.non-existing-id.eth', signature: 'SOME_SIGNATURE', gasPrice: '1', gasToken: ETHER_NATIVE_TOKEN.address}, EMPTY_DEVICE_INFO);
      await expect(creationPromise)
        .to.be.eventually.rejectedWith('ENS domain alex.non-existing-id.eth does not exist or is not compatible with Universal Login');
    });

    it('deploy should add deviceInfo', async () => {
      const keyPair2 = createKeyPair();
      const ensName = 'jarek.mylogin.eth';
      const {futureContractAddress, signature} = await createFutureWallet(keyPair2, ensName, factoryContract, wallet, ensService);
      const creationPromise = walletService.deploy({publicKey: keyPair2.publicKey, ensName, signature, gasPrice: '1', gasToken: ETHER_NATIVE_TOKEN.address}, EMPTY_DEVICE_INFO);
      await expect(creationPromise).to.be.fulfilled;
      expect(fakeDevicesService.addOrUpdate).be.calledOnceWithExactly(futureContractAddress, keyPair2.publicKey, EMPTY_DEVICE_INFO);
    });

    it('throw error if gasPrice is 0', async () => {
      const ensName = 'name.mylogin.eth';
      const {signature} = await createFutureWallet(keyPair, ensName, factoryContract, wallet, ensService);
      const creationPromise = walletService.deploy({publicKey: keyPair.publicKey, ensName, signature, gasPrice: '0', gasToken: ETHER_NATIVE_TOKEN.address}, EMPTY_DEVICE_INFO);
      await expect(creationPromise).to.be.rejectedWith('Not enough gas');
    });

    it('setup initialize data', async () => {
      const {publicKey} = createKeyPair();
      const ensName = 'qwertyuiop.mylogin.eth';
      const initializeData = await walletService.setupInitializeData({publicKey, ensName, gasPrice: '1', gasToken: ETHER_NATIVE_TOKEN.address});
      const ensArgs = await ensService.argsFor(ensName);
      const expectedInitializeData = encodeInitializeWithENSData([publicKey, ...ensArgs as string[], '1', ETHER_NATIVE_TOKEN.address]);
      expect(initializeData).to.eq(expectedInitializeData);
    });

    afterEach(() => {
      fakeDevicesService.addOrUpdate.resetHistory();
    });
  });
});