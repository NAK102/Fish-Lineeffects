/*
-------------------------------------------
      ___           ___           ___     
     /\__\         /\__\         /\  \    
    /:/  /        /::|  |       /::\  \   
   /:/  /        /:|:|  |      /:/\:\  \  
  /:/  /  ___   /:/|:|  |__   /:/  \:\  \ 
 /:/__/  /\__\ /:/ |:| /\__\ /:/__/ \:\__\
 \:\  \ /:/  / \/__|:|/:/  / \:\  \ /:/  /
  \:\  /:/  /      |:/:/  /   \:\  /:/  / 
   \:\/:/  /       |::/  /     \:\/:/  /  
    \::/  /        /:/  /       \::/  /   
     \/__/         \/__/         \/__/    

        Unauthorized Fish Edition
                 v1.0
-------------------------------------------
*/

let content = "";
let p = Vars.player;
let spf = 0.1;
let mpf = 0.7; //messages per frame, /msg has its own ratelimit
let messageQueue = []; //what to send
let targetQueue = []; //who to send it to
let msgcooldown = 0; //timer
let labelDuration = spf*4.5; //increase this if messages flicker

let gameX = 0
let gameY = 0

let instructions = "UNO by null\nOn your turn, a /msg from the host will tell you your hand\nTo save space, skips are noted as , reverses as R, draw twos as ②, wilds as W, and wild draw fours as ④\nPress the draw button to take a card and end your turn (this can be done at any time)\nPress both the color and the value buttons, then the confirm button, to play a card\nWhen playing a wild card, the color buttons instead control what color you want to switch to"

let defaultDeck = [ 
/* behold! the magic number-inator!
0-9 r, 10-19 g, 20-29 b, 30-39 y, 
40 - 43 skip rgby, 44-47 reverse rgby
48-51 draw2 rgby, 52 wild, 53 wild draw 4
*/

0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9, //reds
10,11,11,12,12,13,13,14,14,15,15,16,16,17,17,18,18,19,19, //greens
20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29, //blues
30,31,31,32,32,33,33,34,34,35,35,36,36,37,37,38,38,39,39, //yellows
40,40,41,41,42,42,43,43, //skips
44,44,45,45,46,46,47,47, //reverses
48,48,49,49,50,50,51,51, //drawtwos
52,52,52,52, //wilds
53,53,53,53  //wild draw fours
]

let cardDisplay = [
"[red]0","[red]1","[red]2","[red]3","[red]4","[red]5","[red]6","[red]7","[red]8","[red]9",

"[green]0","[green]1","[green]2","[green]3","[green]4","[green]5","[green]6","[green]7","[green]8","[green]9",

"[blue]0","[blue]1","[blue]2","[blue]3","[blue]4","[blue]5","[blue]6","[blue]7","[blue]8","[blue]9",

"[#ffff]0","[#ffff]1","[#ffff]2","[#ffff]3","[#ffff]4","[#ffff]5","[#ffff]6","[#ffff]7","[#ffff]8","[#ffff]9",

"[red]","[green]","[blue]","[yellow]",
"[red]R","[green]R","[blue]R","[yellow]R",
"[red]②","[green]②","[blue]②","[yellow]②",
"[purple]W","[purple]④"
];

let colorcheck = [
[0,1,2,3,4,5,6,7,8,9,40,44,48], //reds
[10,11,12,13,14,15,16,17,18,19,41,45,49], //greens
[20,21,22,23,24,25,26,27,28,29,42,46,50], //blues
[30,31,32,33,34,35,36,37,38,39,43,47,51] //yellows
];

let startHandSize = 7;

let players = [];
let bannedNames = ["OUT"];

let drawPile = [];
let discardPile = [];
let hands = [];
let turn = 0;
let currentPlayer //current player's object
let turnCompleted = false; //when this true, current player has played, move on to next player ect.
let unoreverse = false;

let pickedCard = -1;
let pickedColor = -1;

let saveMove = false;
let repspam = false;

let lastWildColor = -1 //rgby

let gameState = 0; //idle, waiting for players, running, won
// enum? what's that newfangled thing do?

let cardbuttons = ["0","1","2","3","4","5","6","7","8","9","SKIP","REVERSE","+2","WILD","WILD+4"];
let colorbuttons = ["[red]RED","[green]GREEN","[blue]BLUE","[yellow]YELLOW"];

let winner = -1;

Timer.instance().clear();
startyUppy();
Timer.schedule(()=>{
    try{
    doTheThing();
    } catch(error){
        print("[#ff]Oh no "+error)
        Timer.instance().clear();
    }
},0,spf);

/*
    Groups.player.forEach(t => {
        sendQueue(t.plainName(),"i have sneakily sent this message to everyone lmao");
    });
*/

function startyUppy(){
    gameX = p.x
    gameY = p.y
}

function drawLabel(text,x,y){
    content += [
            "\""+text+"\"", 
            labelDuration,
            x, 
            y,
        ].join(",") + "|";
}

function doTheThing(){
    content = "";
    msgcooldown += spf;
    if(messageQueue.length>0&&msgcooldown>mpf){ //empty message queue slowly
        
        send();
        msgcooldown=0;
    }
    
    switch(gameState){
        case 0:
            gameIdle();
            break;
        case 1:
            gameWait();
            break;
        case 2:
            gameRunning();
            break;
        case 3:
            gameWon();
            break;
    }
    makeMoveButton();
    if(content){
        Call.serverPacketReliable("bulkLabel",content);
    }
}

function gameIdle(){
    drawLabel("[orange]                       UNO\n\n[gray]Unauthorized fish edition by null",gameX,gameY+22)
    if(makeButtonHost("[orange]start","[yellow]>start<","[white]>start<",gameX,gameY-16,6)){
        gameState = 1
    }
}

function gameWait(){
    checkPlayerList();
    let jr = makeButtonAnyone("[blue]join game","[green]>join game<","[white]>join game<",gameX-50,gameY+50,15);
    if(jr){
        if(!players.includes(jr)&&jr!=p.id){
            players.push(jr);
        }
        
    }

    let tr = makeButtonAnyone("[gray]leave game","[orange]>leave game<","[white]>leave game<",gameX+50,gameY+50,20);
    if(tr && players){
        rem(players,tr)
        
    }
    if(players.length>=2){
        if(makeButtonHost("[#90ff90]start game","[#00ffff]>start game<","[white]>start game<",gameX+60,gameY,15)){
            gameState = 2
            resetDeck();
        }
    }
    
    makeInstructions();
    makePlayerDisplay();
}

function gameRunning(){
    checkPlayerList();
    makeInstructions();
    makePlayerDisplay();
    makePileDisplay();
    if(getActualPlayerCount()<2){
        gameState = 3;
        winner = -1;
        return
    }
    while(players[turn] == "OUT"){
        incrementTurn();
    }
    if(makeButtonHost("[#af5050]stop game","[#ff0000]>stop game<","[white]>stop game<",gameX-25,gameY-30,10)){
        gameState = 1
    }
    
    let tr = makeButtonAnyone("[gray]leave game","[red]>leave game<","[white]>leave game<",gameX+80,gameY-30,10);
    if(players.includes(tr)){
        players[players.indexOf(tr)] = "OUT"
        
    }
    if(turnCompleted){
        incrementTurn();
    }

    if(makeButtonPlayer(currentPlayer,"Draw a card",">Draw a card<","[gray]>Draw a card<",currentPlayer.x-70,currentPlayer.y+30,20,1)){
        turnCompleted = true;
        draw(1,turn);
    }
    drawLabel("OR",currentPlayer.x-70,currentPlayer.y);
    if(!turnCompleted){
        makeMoveDisplay();
    }
    if(turnCompleted){ //remember to NEVER allow both draw and confirm card
        incrementTurn();
    }
}

function gameWon(){
    let winnerName = "";
    let rainbow = ["[red]","[orange]","[yellow]","[green]","[blue]","[purple]"];
    let confetii = ["▲","△","▶","▷","▼","▽","◀","◁"];
    let confetiiSpread = 200;
    let confetiiAmount = 3;
    Groups.player.forEach(t => {
        if(t.id==winner){
            winnerName = t.name;
        }
    });
    if(winner==-1){
        drawLabel("[brown]NOBODY WINS :(",gameX,gameY+30)
    } else {
        drawLabel(winnerName+arrayRandom(rainbow)+" IS THE WINNER",gameX,gameY+30)
        for(let i = 0;i<confetiiAmount;i++){
            drawLabel(arrayRandom(rainbow)+arrayRandom(confetii),gameX+(Math.random()-0.5)*confetiiSpread,gameY+(Math.random()-0.5)*confetiiSpread)
        }
    }
    if(makeButtonHost("[green]new game","[#00ffaf]>new game<","[white]>new game<",gameX,gameY-30,30)){
        gameState = 1
        players = [];
    }
}

function makeButtonHost(defaultTx,hoverTx,clickTx,bx,by,buttonSize){
    if(saveMove){
        return false
    }
    let tmp = ""
    let en = false
    if(Math.abs(bx-p.mouseX)+Math.abs(by-p.mouseY)<buttonSize){
        if(p.shooting){
            tmp = clickTx
            en = true
        } else {
            tmp = hoverTx
        }
    } else {
        tmp = defaultTx
    }
    drawLabel(tmp,bx,by)
    return en
}

function makeButtonAnyone(defaultTx,hoverTx,clickTx,bx,by,buttonSize){
    if(saveMove){
        return ""
    }
    let tmp = ""
    let hovered = false
    let clicked = false
    let ret = ""
    Groups.player.forEach(t => {
        let pn = t.plainName()
        if(!bannedNames.includes(pn)){
            if(Math.abs(bx-t.mouseX)+Math.abs(by-t.mouseY)<buttonSize){
                if(t.shooting){
                    clicked = true
                    ret = t.id
                } else {
                    hovered = true
                }
            } else {
                tmp = defaultTx
            }
        }
    });
    if(clicked){
        tmp = clickTx
    } else if(hovered){
        tmp = hoverTx
    } else {
        tmp = defaultTx
    }
    
    drawLabel(tmp,bx,by)
    return ret
}

function makeButtonPlayer(tar,defaultTx,hoverTx,clickTx,bx,by,buttonSize,long){
    let tmp = ""
    let en = false
    if(Math.abs((bx-tar.mouseX)/long)+Math.abs(by-tar.mouseY)<buttonSize){
        if(tar.shooting){
            tmp = clickTx
            en = true
        } else {
            tmp = hoverTx
        }
    } else {
        tmp = defaultTx
    }
    drawLabel(tmp,bx,by)
    return en
}

function send(){
    let name = targetQueue.shift();
    let message = messageQueue.shift();
    try{
        let deploy = "/msg "+name+" "+message;
        Call.sendChatMessage(deploy)
    } catch(error){
        //ignore error :)
        print("oof: "+name)
    }
}

function sendQueue(target, content){
    targetQueue.push(target);
    messageQueue.push(content);
}

function rem(a, ele) {
    a.forEach((item, index) => {
        if (item === ele) {
            a.splice(index, 1);
        }
    });
    return a;
}

function makeMoveButton(){
    let mot = makeButtonHost("[green]","[white]()","",gameX,gameY,5);
    if(mot || saveMove){
        gameX = p.mouseX;
        gameY = p.mouseY;
        saveMove = true;
    }
    if(!p.shooting){
        saveMove = false;
    }
}

function makeInstructions(){
    makeButtonAnyone("[gray]Instructions",instructions,instructions,gameX,gameY-80,10)
}

function makePlayerDisplay(){
    let next = getNext();
    if(players){
        let st = "[purple]Host: "+p.name+"\n[orange]Players:"
        for(let i = 0;i<players.length;i++){
            st += "\n";
            if(i==turn){
                st += "[white]▶ "
            }
            if(i==next){
                st += "[white]▷ "
            }
            if(players[i] == "OUT"){
                st += "[#ff]"+players[i]+"[white]";
            } else {
                if(gameState == 2){
                    st += makePlayerDisplayCardCount(i);
                }
                st += "[white]"+Groups.player.getByID(players[i]).name;
            }
            
        }
        drawLabel(st,gameX-150,gameY);
    }
}

function makePlayerDisplayCardCount(i){
    let st = ""
    let len = hands[i].length
    if(len<2){
        st += "[#00ffff]";
    } else if(len<5) {
        st += "[green]";
    } else if(len<10) {
        st += "[yellow]";
    } else if(len<15) {
        st += "[orange]";
    } else if(len<20) {
        st += "[red]";
    } else if(len<25) {
        st += "[brown]";
    } else {
        st += "[#ff00ff]"
    }
    st += " "
    st += len
    st += "[gray] - "
    return st
}

function makePileDisplay(){
    let st = " cards"
    if(drawPile.length==1){
        st = " card"
    }
    drawLabel("[gray]▶------◀\n\n"+drawPile.length+st+"\n\n▶------◀",gameX-50,gameY+80)
    drawLabel("[gray]DRAW PILE",gameX-50,gameY+150)
    let tmp = ""
    let dis = cardDisplay[discardPile[discardPile.length-1]]
    tmp += dis.slice(0,dis.indexOf("]")+1)
    tmp += "▶------◀\n\n       ";
    tmp += dis
    tmp += "\n\n▶------◀";
    drawLabel(tmp,gameX+50,gameY+80)
    if(discardPile[discardPile.length-1]>=52){
        drawLabel("[purple]Wild color: "+colorbuttons[lastWildColor],gameX+50,gameY+125)
    }
    drawLabel("[gray]DISCARD PILE",gameX+50,gameY+150)
}

function resetDeck(){ //called whenever a game starts
    hands = [];
    discardPile = [];
    turn = 0;
    unoreverse = false;
    queueSkip = false;
    drawPile = defaultDeck.map((x) => x); //duplicate
    shuffle(drawPile);
    
    for(let i = 0;i<players.length;i++){
        let tmp = []
        for(let k = 0;k<startHandSize;k++){
            if(drawPile.length > 0){
                tmp.push(drawPile.pop())
            }
            
        }
        hands.push(tmp);
        sendHand(i);
    }
    while(discardPile.length==0){ //technically not regulation but i think better than just losing an effect card
        if(drawPile[drawPile.length-1]<=40){
            discardPile.push(drawPile.pop());
        } else {
            shuffle(drawPile);
        }
    }
    updateCurrentPlayer(); //needed to get the current player right
}

function shuffle(array) { //stole this lmao
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function checkPlayerList(){
    let tnames = []
    Groups.player.forEach(t => {
        tnames.push(t.id)
    });
    if(gameState == 1){
        players = players.filter(x => tnames.includes(x))
    } else {
        for(let i = 0;i<players.length;i++){
            if(players[i] != "OUT" && !tnames.includes(players[i])){
                players[i] = "OUT"
                print("BONK")
            }
        }
    }
}

function sendHand(tar){
    let msgLen = 11
    if(players[tar]=="OUT"){
        return
    }
    let inpoot = hands[tar];
    inpoot.sort((x, y) => x - y);
    let outpoot = ""
    for(let i = 0;i<inpoot.length;i++){
        if(i%msgLen != 0){
            outpoot += "[]|"
        }
        outpoot += cardDisplay[inpoot[i]]
        if(i%msgLen==msgLen-1 && outpoot != ""){
            sendQueue(players[tar],outpoot);
            outpoot = "";
        }
    }
    if(outpoot != ""){
        sendQueue(players[tar],outpoot);
    }
}

function updateCurrentPlayer(){
    Groups.player.forEach(t => {
        if(t.id == players[turn]){
            currentPlayer = t;
        }
    });
}

function incrementTurn(){
    print(turn)
    if(hands[turn].length == 0){
        gameState = 3;
        winner = players[turn];
        return;
    }
    turnTimeElapsed = 0;
    pickedCard = -1;
    pickedColor = -1;
    if(queueSkip){
        turn = getNext();
        queueSkip = false;
    }
    turn = getNext();
    updateCurrentPlayer();
    turnCompleted = false;
    sendHand(turn);
}

function reshuffleDeck(){
    let keep = discardPile.pop();
    drawPile = discardPile.slice();
    shuffle(drawPile);    
    discardPile = [keep];
}

function getActualPlayerCount(){
    let k = 0
    for(let i = 0;i<players.length;i++){
        if(players[i] != "OUT"){
            k++;
        }
    }
    return k
}

function makeMoveDisplay(){ //if it aint broke
    for(let i = 0;i<cardbuttons.length;i++){
        if(pickedCard == i){
            drawLabel("[gray]>"+cardbuttons[pickedCard]+"<",currentPlayer.x+50,70+currentPlayer.y-i*10);
        } else {
            if(makeButtonPlayer(currentPlayer,cardbuttons[i],"[red]>"+cardbuttons[i]+"<","[white]>"+cardbuttons[i]+"<",currentPlayer.x+50,70+currentPlayer.y-i*10,5,3)){
                pickedCard = i;
            }
        }
    }
    for(let i = 0;i<colorbuttons.length;i++){
        if(pickedColor == i){
            drawLabel("[gray]>"+colorbuttons[pickedColor]+"[gray]<",currentPlayer.x+100,30+currentPlayer.y-i*20);
        } else {
            if(makeButtonPlayer(currentPlayer,colorbuttons[i],">"+colorbuttons[i]+"[white]<","[gray]>"+colorbuttons[i]+"[gray]<",currentPlayer.x+100,30+currentPlayer.y-i*20,10,1)){
                pickedColor = i;
            }
        }
    }
    if(makeButtonPlayer(currentPlayer,"[gray]repeat hand","[blue]>repeat hand<","[white]>repeat hand<",currentPlayer.x,currentPlayer.y+60,10,2)){
        if(!repspam){
            messageQueue = [];
            targetQueue = [];
            sendHand(turn);
            repspam = true
        }
    } else {
        repspam = false
    }

    let movePicked = false
    if(pickedCard==-1 || pickedColor==-1){
        drawLabel(getInformText(),currentPlayer.x-70,currentPlayer.y-30);
    } else {
        movePicked = makeButtonPlayer(currentPlayer,getInformText(),">"+getInformText()+"<",">"+getInformText()+"<",currentPlayer.x-70,currentPlayer.y-30,20,2)
    }
    if(movePicked){
        if(checkIfValid()){
            turnCompleted = true
            computeMove();
        } else{
            if(messageQueue.length==0){
                sendQueue(currentPlayer.id,"[#ff]Invalid move")
            }
        }
    }
}

function getInformText(){
    if(pickedCard==-1){
        return "Choose a card first"
    }
    if(pickedColor==-1){
        return "Choose a color first"
    }
    if(pickedCard<=12){
        return "Play a "+colorbuttons[pickedColor]+"[white] "+cardbuttons[pickedCard]
    } else {
        return "Play a "+cardbuttons[pickedCard]+" and set color "+colorbuttons[pickedColor]+"[white]"
    }
}

function computeMove(){
    var tar = convertToId(pickedCard,pickedColor);
    hands[turn].splice(hands[turn].indexOf(tar), 1);
    discardPile.push(tar)
    let next = getNext();
    
    if(tar>=40){
        if(tar <= 43){
            queueSkip = true;
        } else if(tar<=47){
            unoreverse = !unoreverse;
        } else if(tar<=51){
            draw(2,next);
            queueSkip = true;
        } else if(tar==52){
            lastWildColor = pickedColor;
        } else {
            lastWildColor = pickedColor;
            draw(4,next);
        }
    }
}

function checkIfValid(){
    let testcard = convertToId(pickedCard,pickedColor);
    let compare = discardPile[discardPile.length-1]
    print("[green]"+testcard+" | "+pickedCard+" | "+pickedColor)
    if(hands[turn].includes(testcard)){
        if(testcard>=52){
            return true; //wilds
        }
        let col = subarrayFind(colorcheck,testcard)
        if(colorcheck[col].includes(compare)){
            return true;
        }
        if(testcard<40 && compare<40 && testcard%10 == compare%10){
            return true;
        }
        if(testcard>=40 && compare>=40 && testcard <= 43 && compare <= 43){
            return true;
        }
        if(testcard>=44 && compare>=44 && testcard <= 47 && compare <= 47){
            return true;
        }
        if(testcard>=48 && compare>=48 && testcard <= 51 && compare <= 51){
            return true;
        }
        if(col==lastWildColor&&compare>=52){
            return true;
        }
    }
    return false;
}

function draw(amount,tar){
    for(let i = 0;i<amount;i++){
        if(drawPile.length==0){
            reshuffleDeck();
        }
        hands[tar].push(drawPile.pop());
    }
}

function convertToId(card,color){ //magic numbers lmao i have no idea what all these do
    if(card<=9){
        return card+(color*10)
    } else if(card<=12){
        return ((card-10)*4)+color+40
    } else {
        return 39+card
    }
}

function subarrayFind(arr, tar) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].includes(tar)) {
            return i;
        }
    }
}

function arrayRandom(tar) {
  return tar[Math.floor(Math.random() * tar.length)];
}

function getNext(){
    if(players.length<2){
        return -1;
    }
    let next = turn
    do {
        if(unoreverse){
            next -=1
        } else {
            next +=1
        }
        if(next<0){
            next = players.length-1
        }
        if(next>players.length-1){
            next = 0
        }
    } while (players[next]=="OUT")
    return next;
}