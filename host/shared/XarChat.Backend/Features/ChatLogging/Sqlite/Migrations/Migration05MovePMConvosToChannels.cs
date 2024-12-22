using Microsoft.Data.Sqlite;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{
    internal class Migration05MovePMConvosToChannels : MigrationBase
    {
        protected override int Version => 5;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            try
            {
                // Migrate to new channels table to include PM convos as channels
                await ExecuteNonQueryAsync(
                    @"CREATE TABLE channel_new (
                    id integer primary key,
                    channeltype text not null,
                    name text,
                    title text,
                    mycharacterid integer,
                    interlocutorcharacterid integer,

                    CHECK (
                        (channeltype = 'C' and name is not null and title is not null)
                        or (channeltype = 'P' and mycharacterid is not null and interlocutorcharacterid is not null)
                    )
                )",
                    cnn, xa, cancellationToken);
                await ExecuteNonQueryAsync(
                    @"INSERT INTO channel_new (id, channeltype, name, title)
                  SELECT id, 'C', name, title
                  FROM channel",
                    cnn, xa, cancellationToken);
                await ExecuteNonQueryAsync(
                    @"INSERT INTO channel_new (channeltype, mycharacterid, interlocutorcharacterid)
                  SELECT DISTINCT 'P', mycharacterid, interlocutorcharacterid
                  FROM pmconvomessage",
                    cnn, xa, cancellationToken);

                await ExecuteNonQueryAsync(
                    @"DROP INDEX ix_channel_title",
                    cnn, xa, cancellationToken);
                await ExecuteNonQueryAsync(
                    @"DROP VIEW viewchannelmessage",
                    cnn, xa, cancellationToken);
                await ExecuteNonQueryAsync(
                    @"DROP VIEW viewpmconvomessage",
                    cnn, xa, cancellationToken);

                await ExecuteNonQueryAsync(
                    @"DROP TABLE channel",
                    cnn, xa, cancellationToken);

                await ExecuteNonQueryAsync(
                    @"ALTER TABLE channel_new RENAME TO channel",
                    cnn, xa, cancellationToken);

                await ExecuteNonQueryAsync(
                    @"CREATE UNIQUE INDEX ix_channel_unique_c on channel (channeltype, name)
                      where channeltype = 'C'",
                    cnn, xa, cancellationToken);
                await ExecuteNonQueryAsync(
                    @"CREATE UNIQUE INDEX ix_channel_unique_p on channel (channeltype, mycharacterid, interlocutorcharacterid)
                      where channeltype = 'P'",
                    cnn, xa, cancellationToken);

                await ExecuteNonQueryAsync(
                    @"CREATE VIEW viewchannelmessage as
                        select m.id, c.name as channelname, c.title as channeltitle, sc.name as speaker, m.messagetype, ts.value as messagetext, m.timestamp
                        from channelmessage m
                        inner join channel c on c.id = m.channelid
                        inner join character sc on sc.id = m.speakingcharacterid
                        inner join strings ts on ts.id = m.textstringid
                        where c.channeltype = 'C'",
                    cnn, xa, cancellationToken);
                await ExecuteNonQueryAsync(
                    @"CREATE VIEW viewpmconvomessage as
	                    select m.id, mc.name as mycharacter, ic.name as interlocutor, sc.name as speaker, m.messagetype, ts.value as messagetext, m.timestamp
	                    from channelmessage m
	                    inner join channel c on c.id = m.channelid
	                    inner join character mc on mc.id = c.mycharacterid
	                    inner join character ic on ic.id = c.interlocutorcharacterid
	                    inner join character sc on sc.id = m.speakingcharacterid
	                    inner join strings ts on ts.id = m.textstringid
	                    where c.channeltype = 'P'",
                    cnn, xa, cancellationToken);

                await ExecuteNonQueryAsync(
                    @"INSERT INTO channelmessage (channelid, speakingcharacterid, messagetype, textstringid, 
                            timestamp, genderid, onlinestatusid)
                      SELECT (SELECT id FROM channel c 
                        WHERE c.channeltype = 'P'
                            AND c.mycharacterid = pmc.mycharacterid
                            AND c.interlocutorcharacterid = pmc.interlocutorcharacterid) AS channelid,
                    pmc.speakingcharacterid,
                    pmc.messagetype, pmc.textstringid, pmc.timestamp, pmc.genderid, pmc.onlinestatusid
                  FROM pmconvomessage pmc",
                    cnn, xa, cancellationToken);

                await ExecuteNonQueryAsync(
                    @"DROP TABLE pmconvomessage",
                    cnn, xa, cancellationToken);


                // Add additional indexes for searching
                await ExecuteNonQueryAsync(
                    @"CREATE INDEX ix_channelmessage_ordered on channelmessage(timestamp, textstringid)",
                    cnn, xa, cancellationToken);
                await ExecuteNonQueryAsync(
                    @"CREATE INDEX ix_channelmessage_bytextstringid on channelmessage(textstringid, timestamp)",
                    cnn, xa, cancellationToken);
            }
            catch (Exception ex)
            {
                throw;
            }
        }
    }
}
