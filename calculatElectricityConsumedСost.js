
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
    devices.sort((a,b) =>  a.duration - b.duration).reverse();

    devices.forEach( (item) => {
        let deviceWorkTime  = item.duration;
        let deviceMode = item.mode;
        let devicePower = item.power;
        let energySum = 0;
        
        // Найдем дешевый период
        let from = findCheaper(deviceWorkTime, hoursRates, deviceMode, devicePower, hoursPower, maxPower);
        // Добавим в расписание и потребляемую мощность
        for(let i = from; i < from + deviceWorkTime ; i++){
            schedule[i].push(item.id);
            hoursPower[i]+= devicePower;
        }

        // суммарная стоимость потребления прибора
        energySum = hoursRates.reduce( (sum = 0, current = 0, index = 0) => {
            return schedule[index].indexOf(item.id) >= 0 ? sum + current * devicePower *0.001  : sum + 0 ;
        }, 0);

        // Округлим до 4-ех знаков после запятой
        energySum = Math.round(energySum * 10000) / 10000;

        consumedEnergy.push( {'id': item.id, 'energySum' : energySum });
    });

    // Перегоним результат в JSON
    let result = {
        schedule: {},
        consumedEnergy: {
            value: 0,
            devices: {}
        }
    };

    schedule.forEach((item, index) => {
        result.schedule[index] = item;
    });

    consumedEnergy.forEach( (item) => {
        result.consumedEnergy.value += item.energySum;
        result.consumedEnergy.devices[item.id] = item.energySum;
    } );

    return result;
}

function findCheaper(hours, hoursRates, mode, devicePower, hoursPower, maxPower) {
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
                let cash = getHoursRatesCash(tmpDay, offset, i, hours);
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
                    let cash = getHoursRatesCash(tmpNight2, offset, i, hours);
                    value.push(cash);
                    interval.push(offset-i+21);
                }
                offset+=7;
            }

            tmpNight.splice(7,3);
            offset-=3;

            for(let i = 0; i <= offset && i + hours <= 7; i++){
                let cash = getHoursRatesCash(tmpNight, offset, i, hours);
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
                let cash = getHoursRatesCash(hoursRates, offset, i, hours);
                value.push(cash);
                interval.push(offset-i);
            }
            break;
    }

    // Удаляем варианты при максимальной потребляемая мощности.
    let tmpHoursPower = hoursPower.slice();
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
    }

    // Находим выгодный вариант
    let minCash = Math.min.apply(null, value);
    let desiredCombination = value.indexOf(minCash);
    from = interval[desiredCombination];

    return from;
}

function getHoursRatesCash(hoursRates, offset, index, hours) {
    //копируем массив
    let tmpHoursRates = hoursRates.slice();

    // Убираем ** оставляем ___
    let tmpHoursRates2 = tmpHoursRates.splice(offset-index, hours);

    // Сумма потраченных денег в эти часы **
    let cash = tmpHoursRates2.reduce( (sum, current) => {
        return sum + current;
    });

    return cash;
}

let json = require('./input.json');

console.log(calculatElectricityConsumedСost(json));
