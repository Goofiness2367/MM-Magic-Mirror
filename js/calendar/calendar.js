var calendar = {
	eventList: [],
	calendarLocation: '.calendar',
	updateInterval: 60000,
	updateDataInterval: 60000,
	fadeInterval: 0,
	intervalId: null,
	dataIntervalId: null,
	params: {
		origin: keys.traffic.params.origin,
		destination: '0,0',
		departure_time: keys.traffic.params.departure_time,
		key: keys.traffic.params.key
	},
	traffic: config.calendar.traffic,
	travelTime: 0,
	travelBuffer: 300,
	maximumEntries: keys.calendar.maximumEntries || 10
};

calendar.updateData = function (callback) {

	new ical_parser("controllers/calendar.php" + "?url="+encodeURIComponent(keys.calendar.url), function(cal) {
		var events = cal.getEvents();
		this.eventList = [];

		for (var i in events) {

			var e = events[i];
			for (var key in e) {
				var value = e[key];
				var separator = key.search(';');
				if (separator >= 0) {
					var mainKey = key.substring(0,separator);
					var subKey = key.substring(separator+1);

					var dt;
					if (subKey == 'VALUE=DATE') {
						//date
						dt = new Date(value.substring(0,4), value.substring(4,6) - 1, value.substring(6,8));
					} else {
						//time
						dt = new Date(value.substring(0,4), value.substring(4,6) - 1, value.substring(6,8), value.substring(9,11), value.substring(11,13), value.substring(13,15));
					}

					if (mainKey == 'DTSTART') e.startDate = dt;
					if (mainKey == 'DTEND') e.endDate = dt;
				}
			}

			if (e.startDate == undefined){
				//some old events in Gmail Calendar is "start_date"
				//FIXME: problems with Gmail's TimeZone
				var days = moment(e.DTSTART).diff(moment(), 'days');
				var seconds = moment(e.DTSTART).diff(moment(), 'seconds');
				var startDate = moment(e.DTSTART);
			} else {
				var days = moment(e.startDate).diff(moment(), 'days');
				var seconds = moment(e.startDate).diff(moment(), 'seconds');
				var startDate = moment(e.startDate);
			}

			//only add future events, days doesn't work, we need to check seconds
			if (seconds >= 0) {
				if (seconds <= 60*60*5) {
					var time_string = moment(startDate).fromNow();
					var unix_time = moment(startDate).unix();
					if (e.LOCATION !== undefined){
						var eventLocation = e.LOCATION;						
					}
				}else if (seconds >= 60*60*24*2){
					var time_string = moment(startDate).fromNow();
				}else {
					var time_string = moment(startDate).calendar();
				}
				if (!e.RRULE) {
					if (typeof eventLocation !== 'undefined') {
						this.eventList.push({'description':e.SUMMARY,'location':eventLocation,'unixTime':unix_time,'seconds':seconds,'days':time_string});
					} else{
						this.eventList.push({'description':e.SUMMARY,'seconds':seconds,'days':time_string});
					}					
				}
				e.seconds = seconds;
			}
			
			// Special handling for rrule events
			if (e.RRULE) {
				var options = new RRule.parseString(e.RRULE);
				options.dtstart = e.startDate;
				var rule = new RRule(options);
				
				var today = new Date();
				var twoWeeks = new Date(today.getFullYear(), today.getMonth(), today.getDate()+14);
				var dates = rule.between(today, twoWeeks, true, function (date, i){return i < 10});
				for (var date in dates) {
					var dt = new Date(dates[date]);
					var days = moment(dt).diff(moment(), 'days');
					var seconds = moment(dt).diff(moment(), 'seconds');
					var startDate = moment(dt);
					if (seconds >= 0) {
						if (seconds <= 60*60*5 || seconds >= 60*60*24*2) {
							var time_string = moment(dt).fromNow();
						} else {
							var time_string = moment(dt).calendar()
						}
						this.eventList.push({'description':e.SUMMARY,'seconds':seconds,'days':time_string});
					}           
				}
			}
		}

		this.eventList = this.eventList.sort(function(a,b){return a.seconds-b.seconds});

		// Limit the number of entries.
		this.eventList = this.eventList.slice(0, calendar.maximumEntries);

		if (callback !== undefined && Object.prototype.toString.call(callback) === '[object Function]') {
			callback(this.eventList);
		}

	}.bind(this));

};

calendar.updateCalendar = function (eventList) {

	var table = $('<table/>').addClass('xsmall').addClass('calendar-table');
	var opacity = 1;
	
	if(eventList.length > 0){

		if (typeof eventList[0].location !== 'undefined' && calendar.traffic) {
			var geocoder = new google.maps.Geocoder();

			geocoder.geocode( { 'address': eventList[0].location}, function(results, status) {

				if (status === google.maps.GeocoderStatus.OK) {
					var latitude = results[0].geometry.location.lat();
					var longitude = results[0].geometry.location.lng();
					calendar.params.destination = latitude + ',' + longitude;

					$.ajax({
						type: 'GET',
						url: 'controllers/traffic.php?',
						dataType: 'json',
						data: calendar.params,
						success: function (data) {

							var row = $('<tr/>').css('opacity', opacity);
							row.append($('<td/>').html(eventList[0].description).addClass('description'));
							row.append($('<td/>').html(eventList[0].days).addClass('days dimmed'));
							table.append(row);
							opacity -= 1 / (eventList.length + 5);

							var travelTime = data.routes[0].legs[0].duration_in_traffic.value;

							if(travelTime > 0){
								var leaveByTimeSeconds = eventList[0].unixTime - (travelTime + calendar.travelBuffer);
								var unix_time = moment().unix();
								if (leaveByTimeSeconds > (unix_time + calendar.travelBuffer)){
									var leaveByTime = new Date(leaveByTimeSeconds*1000);
									var hours = leaveByTime.getHours();

									if(hours>12){
										hours-=12;
									}

									var minutes = "0" + leaveByTime.getMinutes();
									var formattedTime = hours + ':' + minutes.substr(-2);
									row = $('<tr/>').css('opacity',opacity);
									row.append($('<td/>').html('Leave by ' + formattedTime).addClass('leaveby'));
								} else {
									row = $('<tr/>').css('opacity',opacity);
									row.append($('<td/>').html('Leave now').addClass('leaveby'));
								}

								table.append(row);
								opacity -= 1 / (eventList.length + 5);
							}

							for (var i in eventList) {
								if(i>0) {
									var e = eventList[i];

									row = $('<tr/>').css('opacity', opacity);
									row.append($('<td/>').html(e.description).addClass('description'));
									row.append($('<td/>').html(e.days).addClass('days dimmed'));
									table.append(row);
									opacity -= 1 / (eventList.length + 5);
								}
							}
							$(calendar.calendarLocation).updateWithText(table, this.fadeInterval);

						}.bind(this),
						error: function () {
							calendar.fillTable(eventList,table);
						}
					});
				} else {
					calendar.fillTable(eventList,table);
				}
			});
		} else {
			calendar.fillTable(eventList,table);
		}

	}else{
		$(this.calendarLocation).updateWithText('', this.fadeInterval);
	}

};

calendar.fillTable = function(eventList,table){
	var opacity = 1;

	for (var i in eventList) {
		var e = eventList[i];

		var row = $('<tr/>').css('opacity', opacity);
		row.append($('<td/>').html(e.description).addClass('description'));
		row.append($('<td/>').html(e.days).addClass('days dimmed'));
		table.append(row);
		opacity -= 1 / (eventList.length + 5);
	}
	$(calendar.calendarLocation).updateWithText(table, this.fadeInterval);
};

calendar.init = function () {

	this.updateData(this.updateCalendar.bind(this));
/*
	this.updateCalendar(this.eventList);

	this.intervalId = setInterval(function () {
		this.updateCalendar(this.eventList)
	}.bind(this), this.updateInterval);
*/
	this.dataIntervalId = setInterval(function () {
		this.updateData(this.updateCalendar.bind(this));
	}.bind(this), this.updateDataInterval);

};
