import { ethers, network } from "hardhat";
import { Raffle } from "../typechain-types";

async function main() {
    const [deployer] = await ethers.getSigners();
    // get contract
    const raffle: Raffle = await ethers.getContract("Raffle");
    const entranceFee = await raffle.getEntranceFee();
    console.log("Raffle Address:", raffle.address);
    console.log("Entrance fee: ", entranceFee.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
