// SPDX-License-Identifier: MIT
pragma solidity  ^0.8.7;
// Raffle
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "hardhat/console.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/// @title A sample Raffle Contract
/// @author Lz
/// @notice This contract is for creating an untamperable raffle
/// @dev nothing to mention
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // 
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* state variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players; 
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;
    RaffleState private s_raffleState;
    uint256 private s_lastTimestamp;
    uint256 private immutable i_interval;

    // Lottery state
    address private s_recentWinner;

    event RaffleEnter(address indexed player); // indexed keyword is used to filter events，更容易找到
    event RequestRaffleWinner(uint256 requestId);
    event WinnerPicked(address indexed winner);

    constructor(address vrfCoordinatorV2 // Contract Address
    ,uint256 _entranceFee, bytes32 keyHash, uint64 subscription_Id, uint32 callbackGasLimit, uint256 interval) VRFConsumerBaseV2( vrfCoordinatorV2){
        i_entranceFee = _entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_keyHash = keyHash;
        i_subscriptionId = subscription_Id;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimestamp = block.timestamp;
        i_interval = interval;
    }
    // Enter the lotter (paying some amount)
    function enterRaffle() public payable{
        if(msg.value < i_entranceFee){
            revert Raffle__NotEnoughETHEntered();
        }
        if(s_raffleState != RaffleState.OPEN){
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        // Events Emit an event when we update a dynamic array or mapping
        // Named events with the function name referred
        emit RaffleEnter(msg.sender); // 加入事件
    }


    function getEntranceFee() public view returns(uint256){
        console.log("I was called");
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns(address){
        return s_players[index];
    }
    function getRaffleState() public view returns(RaffleState){
        return s_raffleState;
    }
    function getNumWords() public pure returns(uint32){ // constant可以用pure来代替
        return NUM_WORDS;
    }
    function getNumberOfPlayers() public view returns(uint256){
        return s_players.length;
    }
    function getLastestTimestamp() public view returns(uint256){
        return s_lastTimestamp;
    }
    function getRequestConfirmations() public pure returns(uint16){
        return REQUEST_CONFIRMATIONS;
    }
    function getInterval() public view returns(uint256){
        return i_interval;
    }

    // Pick a random winner
    // 被chainlink-keepers定时调用
    function performUpkeep(bytes calldata performData) external override{
        // Request the random number
        // 2 transaction process
        (bool upKeepNeeded,) = checkUpkeep("");
        if(!upKeepNeeded){
            revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash, // gas消耗上限
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestRaffleWinner(requestId);
    }
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimestamp = block.timestamp;
        if(!success){
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }
    // chainlink keepers调用这个函数
    // 1. 时间间隔应该已经超过
    // 2. lottery应该至少有一个玩家，并且有ETh
    // 3. subscriptionId应该是有效的
    // 4. Lottery 应该在运行状态
    function checkUpkeep(bytes memory checkData) public override returns (bool upkeepNeeded, bytes memory performData) {
        bool isOpen = (s_raffleState == RaffleState.OPEN);
        // (block.stamp - last block timestamp) > interval
        bool timePassed = (block.timestamp - s_lastTimestamp) > i_interval; // 是否超过了某个时间点
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = isOpen && timePassed && hasPlayers && hasBalance; // 自动返回这个bool值，performData是一个空的bytes，不管
    }

    function getRecentWinner() public view returns(address){
        return s_recentWinner;
    }

    // Winner to be selected every X minutes -> complete automated


    // Chainlink Oracle -> Randomness Automated Execution(Chainlink Keepers)
}