import { DeployFunction } from "hardhat-deploy/types";
import { network, ethers } from "hardhat";
import { developmentChains } from "../helper.hardhat.config";

const Base_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium. it costs 0.25 per request
const GAS_PRICE_LINK = 1e9; // calculated value based on the gas price of the chain link per gas
async function deployMock({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    const args = [Base_FEE, GAS_PRICE_LINK];
    if (developmentChains.includes(network.name)) {
        log("Local network detected, deploying mock VRFConsumerV2");
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: args, // takes a baseFee_ and a gasPriceLink
            log: true,
        });
        log("Mocks Deployed");
        log("----------------");
    }
}

const deployMockFunction: DeployFunction = deployMock;
deployMockFunction.tags = ["all", "Mock"];
export default deployMockFunction;
