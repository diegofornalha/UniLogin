import chai, {expect} from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {providers, Wallet, Contract, utils} from 'ethers';
import {createMockProvider, getWallets} from 'ethereum-waffle';
import {createKeyPair, TEST_GAS_PRICE} from '@universal-login/commons';
import WalletContract from '@universal-login/contracts/build/Wallet.json';
import setupWalletService, {createFutureWallet} from '../../../helpers/setupWalletService';
import WalletService from '../../../../lib/integration/ethereum/WalletService';
import ENSService from '../../../../lib/integration/ethereum/ensService';

chai.use(require('chai-string'));
chai.use(sinonChai);


describe('INT: WalletService', async () => {
  let walletService: WalletService;
  let provider: providers.Provider;
  let wallet: Wallet;
  let callback: sinon.SinonSpy;
  let walletContract: Contract;
  let factoryContract: Contract;
  let ensService: ENSService;
  const keyPair = createKeyPair();
  const ensName = 'alex.mylogin.eth';
  let transaction: utils.Transaction;

  before(async () => {
    provider = createMockProvider();
    [wallet] = getWallets(provider);
    ({walletService, callback, factoryContract, ensService, provider} = await setupWalletService(wallet));
    const {futureContractAddress, signature} = await createFutureWallet(keyPair, ensName, factoryContract, wallet, ensService);
    transaction = await walletService.deploy({publicKey: keyPair.publicKey, ensName, gasPrice: TEST_GAS_PRICE, signature});
    walletContract = new Contract(futureContractAddress, WalletContract.interface, provider);
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
      const creationPromise = walletService.deploy({publicKey: wallet.address, ensName: 'alex.non-existing-id.eth', signature: 'SOME_SIGNATURE', gasPrice: '1'});
      await expect(creationPromise)
        .to.be.eventually.rejectedWith('ENS domain alex.non-existing-id.eth does not exist or is not compatible with Universal Login');
    });
  });
});
