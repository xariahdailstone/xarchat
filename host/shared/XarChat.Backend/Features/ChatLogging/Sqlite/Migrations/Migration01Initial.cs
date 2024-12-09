using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Common.DbSchema;

namespace XarChat.Backend.Features.ChatLogging.Sqlite.Migrations
{

    internal class Migration01Initial : MigrationBase
    {
        protected override int Version => 1;

        protected override async Task UpgradeSchema(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            await ExecuteNonQueryAsync(@"
                    create table strings (
                        id integer primary key,
                        value text not null,
                        hash text not null
                    );

                    create virtual table fts_strings using fts5(value, content='strings', content_rowid='id');

                    create trigger strings_ai after insert on strings begin
                        insert into fts_strings(rowid, value) values (new.id, new.value);
                    end;
                    create trigger strings_ad after delete on strings begin
                        insert into fts_strings(fts_strings, rowid, value) values ('delete', old.id, old.value);
                    end;
                    create trigger strings_au after update on strings begin
                        insert into fts_strings(fts_strings, rowid, value) values ('delete', old.id, old.value);
                        insert into fts_strings(rowid, value) values (new.id, new.value);
                    end;
                ", cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync("create unique index ix_strings_hash on strings(hash)", cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(@"
                    create table channel (
                        id integer primary key,
                        name text not null,
                        title text not null
                    )
                ", cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync("create unique index ix_channel_title on channel(title)", cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(@"
                    create table channelmessage (
                        id integer primary key,
                        channelid integer not null,
                        speakingcharacterid integer not null,
                        messagetype integer not null,
                        textstringid integer not null,
                        timestamp integer not null
                    )
                ", cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync("create index ix_channelmessage_channelordered on channelmessage(channelid, timestamp)",
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(@"
                    create table pmconvomessage (
                        id integer primary key,
						mycharacterid integer not null,
                        interlocutorcharacterid integer not null,
                        speakingcharacterid integer not null,
                        messagetype integer not null,
                        textstringid integer not null,
                        timestamp integer not null
                    )
                ", cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync("create index ix_pmconvomessage_channelordered on pmconvomessage(mycharacterid, interlocutorcharacterid, timestamp)", 
                cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(@"
                    create view viewchannelmessage as
                        select m.id, c.name as channelname, c.title as channeltitle, sc.name as speaker, m.messagetype, ts.value as messagetext, m.timestamp
                        from channelmessage m
                        inner join channel c on c.id = m.channelid
                        inner join character sc on sc.id = m.speakingcharacterid
                        inner join strings ts on ts.id = m.textstringid
                ", cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync(@"
                    create view viewpmconvomessage as
                        select m.id, ic.name as interlocutor, sc.name as speaker, m.messagetype, ts.value as messagetext, m.timestamp
                        from pmconvomessage m
                        inner join character ic on ic.id = m.interlocutorcharacterid
                        inner join character sc on sc.id = m.speakingcharacterid
                        inner join strings ts on ts.id = m.textstringid
                ", cnn, xa, cancellationToken);

            await ExecuteNonQueryAsync(@"
                    create table character (
                        id integer primary key,
                        name text not null,
                        namelower text not null
                    )
                ", cnn, xa, cancellationToken);
            await ExecuteNonQueryAsync("create unique index ix_character_name on character(namelower)", 
                cnn, xa, cancellationToken);
        }

        protected override Task StoreSchemaVersionAsync(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        protected override async Task<bool> NeedsUpgradeAsync(SqliteConnection cnn, SqliteTransaction xa, CancellationToken cancellationToken)
        {
            using var cmd = cnn.CreateCommand();
            cmd.Transaction = xa;
            cmd.CommandText = "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='character'";
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            return (result is DBNull) || (result is null) || ((long)result == 0);
        }
    }
}
