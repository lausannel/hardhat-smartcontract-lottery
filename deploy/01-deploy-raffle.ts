import { network, ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { developmentChains, networkConfig } from "../helper.hardhat.config";
import { DeploymentsExtension, Address } from "hardhat-deploy/types";
import { VRFCoordinatorV2Mock } from "../typechain-types";
import { verify } from "../utils/verify";
import { getNamedAccounts, deployments } from "hardhat";

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2"); // 每次向subscription fund 2个eth

async function deployRaffle({
    getNamedAccounts,
    deployments,
}: {
    getNamedAccounts: () => Promise<{
        [name: string]: Address;
    }>;
    deployments: any;
}) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId: number | undefined = network.config.chainId;
    let vrfCoordinatorV2Address, subscriptionId: string;
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock: VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const transactionReponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionReponse.wait();
        subscriptionId = transactionReceipt.events![0].args!.subId;
        log(`subscriptionId: ${subscriptionId}`);
        // fund the subscription
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId!]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId!]["subscriptionId"];
    }
    log(`Now we began to create constructor arguments for Raffle.sol`);
    const entranceFee = networkConfig[chainId!]["entranceFee"];
    const gasLane = networkConfig[chainId!]["gasLane"]; // keyHash
    const callbackGasLimit = networkConfig[chainId!]["callbackGasLimit"];
    const interval = networkConfig[chainId!]["interval"];
    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval];
    log(`Now we began to deploy Raffle.sol`);
    log(`args is ${args}`);
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
    });

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying Raffle contract");
        await verify(raffle.address, args);
    }

    log("---------------");
}
const deployRaffleFunction: DeployFunction = deployRaffle;
deployRaffleFunction.tags = ["all", "Raffle"];
export default deployRaffleFunction;
