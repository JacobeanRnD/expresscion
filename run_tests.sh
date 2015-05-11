#!/bin/bash
# run_tests.sh

DB_PROVIDERS="SCXMLD-simple-database-provider SCXMLD-postgres-database-provider"
SIMULATION_PROVIDERS="SCXMLD-simple-simulation-provider SCXMLD-simple-stateless-simulation-provider"
RESULT_DESC=""
EXIT_STATUS=0

for db in $DB_PROVIDERS
do
	for simulation in $SIMULATION_PROVIDERS
	do
		echo -e "\n****************************************"
		echo -e "Starting tests for: \n $simulation \n $db"
		echo -e "****************************************\n"

		DB_PROVIDER=$db \
		SIMULATION_PROVIDER=$simulation \
		node node_modules/istanbul/lib/cli.js cover node_modules/jasmine/bin/jasmine.js

		status=$?

		echo -e "\nTest result is $status for: \n $simulation \n $db"
		echo -e "****************************************\n"

		RESULT_DESC+="Test result is $status for: \n $simulation \n $db\n\n"

		if [ "$status" != '0' ]; then EXIT_STATUS=$status; fi;
	done
done

echo -e $RESULT_DESC

if [ "$EXIT_STATUS" = '0' ]; then echo SUCCESS; else echo FAILURE; fi;

exit  $EXIT_STATUS