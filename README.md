function getMilk(bottles, money) {
    var cost=bottles*2;
    var giveMoney = prompt("Amount of money given to the robot: ");
    var returned = (giveMoney-cost);
    console.log("leaveHouse");
    console.log("moveRight");
    console.log("moveRight");
    console.log("moveUp");
    console.log("moveUp");
    console.log("moveUp");
    console.log("moveUp");
    console.log("moveRight");
    console.log("moveRight");
    console.log("buy " + bottles + " bottles of milks and returns" + money + " $ amount");
    alert("The robot has got " +bottles+ "number of bottles and retuned " +returned+ "$amount of money");
    console.log("moveLeft");
    console.log("moveLeft");
    console.log("moveDown");
    console.log("moveDown");
    console.log("moveDown");
    console.log("moveDown");
    console.log("moveLeft");
    console.log("moveLeft");
    console.log("enterHouse");
    
}

getMilk(2)

