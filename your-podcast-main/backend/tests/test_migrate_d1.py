import pytest

from migrate_d1 import _split_sql_statements


def test_split_sql_statements_handles_semicolons_in_strings():
    sql = """
    -- comment
    CREATE TABLE sample (
        id INTEGER PRIMARY KEY,
        note TEXT DEFAULT 'a;b'
    );
    INSERT INTO sample (note) VALUES ('x;y');
    """

    statements = _split_sql_statements(sql)

    assert len(statements) == 2
    assert "DEFAULT 'a;b'" in statements[0]
    assert "VALUES ('x;y')" in statements[1]


def test_split_sql_statements_handles_trigger_body():
    sql = """
    CREATE TABLE sample (id INTEGER PRIMARY KEY);
    CREATE TRIGGER sample_trigger
    AFTER INSERT ON sample
    BEGIN
        INSERT INTO sample (id) VALUES (NEW.id + 1);
        INSERT INTO sample (id) VALUES (NEW.id + 2);
    END;
    """

    statements = _split_sql_statements(sql)

    assert len(statements) == 2
    assert statements[1].startswith("CREATE TRIGGER sample_trigger")
    assert "VALUES (NEW.id + 2)" in statements[1]


def test_split_sql_statements_rejects_incomplete_statement():
    with pytest.raises(ValueError):
        _split_sql_statements("CREATE TABLE broken (id INTEGER PRIMARY KEY)")
