
function calculatElectricityConsumedСost (jsonObj) {
    // Входные данные
    let devices = jsonObj["devices"];
    let rates = jsonObj["rates"];
    let maxPower = jsonObj["maxPower"]; 

    //Выходные данные
    let schedule = new Array(24);
    for(let i = 0; i < 24; i++){
        schedule[i] = new Array();
    }
    let consumedEnergy = new Array();

    // Почасовой тариф
    let hoursRates = new Array(24);

    // Затраты мощности по часам
    let hoursPower = new Array(24);
    for(let i = 0; i < 24; i++){
        hoursPower[i] = 0;
    }

    // Запишем сколько каждый час надо платить
    rates.forEach( (item) => {
        let from = item.from;
        let to = item.to;
        let nextDay = item.to < item.from ? 24 : 0;
        for(let i = 0; from - nextDay < to; i++){
            if(from < 24){
                hoursRates[item.from + i] = item.value;
            } else {
                hoursRates[item.from + i - nextDay] = item.value;
            }
            from++;
        }
    });

    // Отсортируем приборы по времени работы от большего к меньшему
    devices.sort(compareWorkTime).reverse();

    devices.forEach( (item) => {
        let deviceWorkTime  = item.duration;
        let deviceMode = item.mode;
        let devicePower = item.power;
        let energySum = 0;
        
        // Найдем дешевый период
        let from = findCheper(deviceWorkTime, hoursRates, deviceMode, devicePower, hoursPower, maxPower);
        // Добавим в расписание и потребляемую мощность
        for(let i = from; i < from + deviceWorkTime ; i++){
            schedule[i].push(item.id);
            hoursPower[i]+= devicePower;
        }
        //TODO:
        // суммарная стоимость потребления прибора
       /* energySum = hoursRates.reduce( (sum, current) => {
            return sum + current ;
        });
        consumedEnergy.push({ "item.id+": energySum });*/

    });

    //TODO: to JSON
    return schedule;
}

function compareRates(a, b) {
    let timeA = a.to - a.from;
    timeA = timeA > 0 ? timeA : timeA + 24;

    let timeB = b.to - b.from;
    timeB = timeB > 0 ? timeB : timeB + 24;

    let powerA = timeA * a.value;
    let powerB = timeB * b.value;

    return powerA - powerB;
}

function compareWorkTime(a, b) {
    return a.duration - b.duration;
}

function findCheper(hours, hoursRates, mode, devicePower, hoursPower, maxPower) {
    let from = 0;
    let offset = 24 - hours;
    let value = [];
    let interval = [];

    if(hours == 24){
        return from;
    }

    switch(mode){
        case 'day':
            offset-=10;
            let tmpDay = hoursRates.slice();
            // Сокращаем массив до режима работы
            tmpDay.splice(21,3);
            tmpDay.splice(0,7);
            for(let i = 0; i <= offset ; i++){
                let tmpHoursRates = tmpDay.slice();
                let tmpHoursRates2 = tmpHoursRates.splice(offset-i, hours);
                let cash = tmpHoursRates2.reduce( (sum, current) => {
                    return sum + current;
                });
                value.push(cash);
                interval.push(offset-i+7);
            }

            // Что бы девайс работал вначале режима. { подгон под output / Кондеционер работает в 23, остальные в начале трафика}
            value.reverse();
            interval.reverse();
            break;
        case 'night':
            offset-=14;
            let tmpNight = hoursRates.slice();
            // Сокращаем массив до режима работы
            tmpNight.splice(7,14);
            // Если можем уложиться с 21 до 00
            if(hours <= 3 ){
                let tmpNight2 = tmpNight.slice();
                tmpNight2.splice(0,7);
                offset-=7;
                for(let i = 0; i <= offset; i++){
                    let tmpHoursRates = tmpNight.slice();
                    let tmpHoursRates2 = tmpHoursRates.splice(offset-i, hours);
                    let cash = tmpHoursRates2.reduce( (sum, current) => {
                        return sum + current;
                    });
                    value.push(cash);
                    interval.push(offset-i+21);
                }
                offset+=7;
            }

            tmpNight.splice(7,3);
            offset-=3;

            for(let i = 0; i <= offset && i + hours <= 7; i++){
                let tmpHoursRates = tmpNight.slice();
                let tmpHoursRates2 = tmpHoursRates.splice(offset-i, hours);
                let cash = tmpHoursRates2.reduce( (sum, current) => {
                    return sum + current;
                });
                value.push(cash);
                interval.push(offset-i);
            }
            // Что бы девайс работал вначале режима.
            value.reverse();
            interval.reverse();
            break;
        default:
            // Проходимся по комбинациям от **__ до __** {*__* - промежуточная},
            // оставляем звездочки для последующего сравнения.
            for(let i = 0; i <= offset; i++){
                //копируем массив
                let tmpHoursRates = hoursRates.slice();

                // Убираем ** оставляем ___
                let tmpHoursRates2 = tmpHoursRates.splice(offset-i, hours);

                // Сумма потраченных денег в эти часы __
                let cash = tmpHoursRates2.reduce( (sum, current) => {
                    return sum + current;
                });

                value.push(cash);
                interval.push(offset-i);
            }
            break;
    }

    //TODO: Определить возможна ли вставка в такой промежуток времени исходя из максимальной мощности
    // Удаляем варианты при максимальной потребляемая мощности.
    /*let tmpHoursPower = hoursPower.slice();
    let deleteInterval = new Array();
    for(let i = 0; i < interval.length; i++){
        let tmpHoursPower2 =  tmpHoursPower.splice(interval[i], hours);
        let saveItem = tmpHoursPower2.every( (number) => number + devicePower < maxPower);
        if(!saveItem) {
            deleteInterval.push(i);
        }
    }
    for(let i = 0; i < deleteInterval.length; i++){
        interval.splice(deleteInterval[i], 1);
        value.splice(deleteInterval[i], 1);
    }*/

    // Находим выгодный вариант
    let minCash = Math.min.apply(null, value);
    let desiredCombination = value.indexOf(minCash);
    from = interval[desiredCombination];

    return from;
}

//let json = require('./input.json');

//calculatElectricityConsumedСost(json);