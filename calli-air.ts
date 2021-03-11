//% weight=45 color=#0011A0 icon="\uf080" block="Calli:Air"
namespace co2Sensor {

    let ledColorList = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let statusLed = false;
    let time = 0;
    let lastCo2 = 0;
    let co2List = [400,400,400,400,400];
    let errList = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    let errCounter = 0;
    let errLimit = 3;
    let interval = 0;
    let init = 0;

    function averageCalc (newValue: number): number{
        let average = 0;           
        for (let i = 0; i < 5; i++){
            average = average + co2List[i];
            if (i < 4){
                co2List[i] = co2List[i+1];
            }            
        }
        co2List[4] = newValue;        
        return Math.trunc(average/5);
    }

    function co2Init(){
        if (init == 0){
            init = 1;
            co2Interval(2);
        }
    }
    
    //% block="CO2-Wert (ppm)"
    export function co2 () : number {
        let co2: number;
        let average: number;

        co2Init();

        if (input.runningTime() < time){           // while interval time is not expired use old value
            co2 = lastCo2;
        }
        else {
            let buffer = pins.i2cReadBuffer(0x23, 3);
            let status = buffer[0];
            co2 = buffer[1] * 256 + buffer[2];
            if (co2 > 4000){
                co2 = lastCo2;
            }
            if (status & 0x01){                    // new co2 value present?
                errCounter = 0;                       // reset time-out counter
                if (statusLed){                    // if RGB-LED blinking activated
                    basic.setLedColor(0x002000);
                    basic.pause(50);
                    basic.turnRgbLedOff();
                }
            }
            else{
                errCounter = errCounter + 1;              // no new co2 value
                if (errCounter > errLimit){                   // if 3 times no new value present
                    if (statusLed){
                        basic.setLedColor(0x200000);
                        basic.pause(50);
                        basic.turnRgbLedOff();
                    }
                }
            }
            time = input.runningTime() + interval * 1000;
            average = averageCalc(co2);
            let diff = Math.abs(average - co2);
                      
            if (diff > 300){        // check plausibility of value
                co2 = average;      
            }
            lastCo2 = co2;
        }
        return co2;
    }

    //% block="Temperatur (°C)"
    export function temperatur() : number {
        let wbuffer = pins.createBuffer(1)
        wbuffer[0] = 9;
        pins.i2cWriteBuffer(0x23, wbuffer);
        let buffer = pins.i2cReadBuffer(0x23, 2);
        let temp = buffer.getNumber(NumberFormat.Int16BE,0)/10;
        return temp;
    }

    //% block="Feuchte (%)"
    export function humidy() : number {
        let wbuffer = pins.createBuffer(1)
        wbuffer[0] = 5;
        pins.i2cWriteBuffer(0x23, wbuffer);
        let buffer = pins.i2cReadBuffer(0x23, 2);
        let temp = (buffer[0] * 256 + buffer[1])/10;
        return temp;
    }

    //% block="Druck (mbar)"
    export function pressure() : number {
        let wbuffer = pins.createBuffer(1)
        wbuffer[0] = 7;
        pins.i2cWriteBuffer(0x23, wbuffer);
        let buffer = pins.i2cReadBuffer(0x23, 2);
        let temp = (buffer[0] * 256 + buffer[1]);
        return temp;
    }
    //% block="Status-LED $newState"
    //% zustand.shadow="toggleOnOff"
    export function statAnz (newState: boolean){
        statusLed = newState;
        if ((statusLed == true) && (newState == false))
            basic.turnRgbLedOff();
    }

    //% block="Zeige LED-Balken mit $ledNumber LEDs, Helligkeit $ledBrightness"
    export function showBar (ledNumber : number, ledBrightness : number ){
        ledNumber = Math.trunc(ledNumber);
        if (ledNumber < 1)          // minimum 1 LED
            ledNumber = 1;
        if (ledNumber > 9)          // maximum 9 LEDs
            ledNumber = 9;
        let color = 0x00FF00; // green
        ledColorList = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let counter = 0; counter < ledNumber; counter ++){
            ledColorList[counter + 1] = color;
            if (counter == 2)
                color = 0xFFFF00; // yellow
            if (counter == 5)
                color = 0xFF0000; // red
        }
        ledShow(ledBrightness);
    }
    
    //% block="Gib Ton mit $frequency | Hz, Lautstärke $volume |% aus"
    export function sound (frequency : number, volume : number){
        let buffer = pins.createBuffer(4);
        buffer[0] = 12;
        buffer[1] = frequency / 256;
        buffer[2] = frequency & 255;
        buffer[3] = volume & 255;
        pins.i2cWriteBuffer(0x23, buffer);
        pins.i2cWriteBuffer(0x23, buffer);
    }

    //% block="Ton aus"
    export function soundOff (){
        let buffer = pins.createBuffer(3);
        buffer[0] = 12;
        buffer[1] = 0;
        buffer[2] = 0;
        pins.i2cWriteBuffer(0x23, buffer);
    }

    //% block="LED $ledNumber|Farbe $color"
    //% advanced=true
    export function ledColor(ledNumber : number, color : number) {
       if ((ledNumber > 0)&&(ledNumber <10)){
           ledColorList[ledNumber] = color;

       }
    }

    //% block="Setze LED $ledNumber auf Farbe $color"
    export function writeLedColor(ledNumber: number, color: number){

        let buffer = pins.createBuffer(4);

        if ((ledNumber > 0)&&(ledNumber <10)){
            ledColorList[ledNumber] = color;
            buffer.setNumber(NumberFormat.Int32BE, 0, color);
            buffer[0] = ledNumber - 1;
            pins.i2cWriteBuffer(0x23, buffer);  
        }
    }

    //% block="Zeige LEDs an mit Helligkeit $ledBrightness"
    //% advanced=true
    export function ledShow(ledBrightness : number){
        let buffer = pins.createBuffer(28);
        let colBuffer = pins.createBuffer(4);
        let bufferCount = 1;
        buffer[0] = 0;
        for (let counter = 1; counter < 10; counter ++){
                colBuffer.setNumber(NumberFormat.Int32BE, 0, ledColorList[counter]);
                buffer[bufferCount] = Math.trunc(colBuffer[1] * ledBrightness / 100);
                buffer[bufferCount+1] = Math.trunc(colBuffer[2] * ledBrightness / 100);
                buffer[bufferCount+2] = Math.trunc(colBuffer[3] * ledBrightness / 100);
                bufferCount = bufferCount + 3;
        }
        pins.i2cWriteBuffer(0x23, buffer);
    }
    
    //% block="Druckkompensation= $pressure mBar"
    //% advanced = true
    export function pressCompensation(pressure: number){
        let buffer = pins.createBuffer(3);

        if (pressure < 700){
            pressure = 700;
        }
        if (pressure > 1400){
            pressure = 1400;
        }

        buffer[0] = 10
        buffer[1] = Math.trunc(pressure / 256);
        buffer[2] = pressure & 255;
        pins.i2cWriteBuffer(0x23, buffer);
    }

    //% block="Messintervall= $newInterval"
    //% advanced = true
    export function co2Interval(newInterval: number){
        if ((newInterval > 0) && (newInterval <= 60)){   // Intervals between 1 and 60 allowed(seconds)
            if (interval != newInterval){          
                interval = newInterval;
                let buffer = pins.createBuffer(2);
                buffer[0] = 9;
                buffer[1] = newInterval;
                pins.i2cWriteBuffer(0x23, buffer);
            }
        }
    }

    //% block="LED-Abschaltung nach $timeout s"
    //% advanced = true
    export function co2LedTimeout(timeout: number){
        let buffer = pins.createBuffer(2);
        if ((timeout >= 0) && (timeout <= 60))
        {
            buffer[0] = 17;
            buffer[1] = timeout;
            pins.i2cWriteBuffer(0x23, buffer);
        }

    }

    //% block="CO2 Fehler"
    //% advanced = true
    export function co2Error(): boolean{
        if (errCounter > errLimit){
            return true;
        }
        else {
            return false;
        }
    }
}

