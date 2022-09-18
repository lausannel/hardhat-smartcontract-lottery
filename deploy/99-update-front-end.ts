import "dotenv/config";
import { ethers, network } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { Raffle } from "../typechain-types";
import * as fs from "fs";
// 每次部署了contract，把一些信息放入前端的json文件中，包括abi和合约的地址
const FRONT_END_ADDRESS_FILE = "../nextjs-smartcontract-lottery/constants/contractAddress.json";
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json";

async function updateEverything() {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating front-end...");
        await updateContractAddresses();
        await updateAbi();
    }
}
async function updateAbi() {
    const raffle: Raffle = await ethers.getContract("Raffle");
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json));
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle");
    const chainId = network.config.chainId!.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESS_FILE, "utf8"));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address);
        }
    } else {
        currentAddresses[chainId] = [raffle.address];
    }
    fs.writeFileSync(FRONT_END_ADDRESS_FILE, JSON.stringify(currentAddresses));
}
const deployUpdate: DeployFunction = updateEverything;
deployUpdate.tags = ["all", "frontend"];
export default deployUpdate;
