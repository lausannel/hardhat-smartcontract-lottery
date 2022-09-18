import { ethers, run, network } from "hardhat";
import "dotenv/config";

async function verify(contractAddress: string, args: any[]) {
    console.log("Verifying SimpleStorage Contract...");
    try {
        await run("verify:verify", {
            address: contractAddress!,
            constructorArguments: args!,
        }); // verify:verify的意思是verify主task下的verify子task，两个任务名恰巧一样
    } catch (error: any) {
        // etherscan非常聪明，当其部署了一个智能合约之后，之后相似的合约会自动verify，所以verify可能会出错，因此需要一个try catch块来看是否出现了这个错误
        if (error.message.toLowerCase().includes("already verified")) {
            console.log("Contract already verified on etherscan");
        } else {
            console.log(error.message);
        }
    }
}

export { verify };
